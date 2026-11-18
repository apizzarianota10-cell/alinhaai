# Arquitetura e Modelagem do Banco de Dados (PostgreSQL / Supabase)

O **PilatesFlow** foi modelado como um sistema relacional robusto, normalizado e estritamente aderente às diretrizes da LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018) e aos princípios de auditoria clínica e segurança do paciente.

---

## 1. Esquema Relacional de Tabelas

### 1.1 Clínicas & Configurações
```sql
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slogan VARCHAR(255),
    cnpj VARCHAR(20),
    phone VARCHAR(20) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT NOT NULL,
    working_days JSONB NOT NULL DEFAULT '["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]'::jsonb,
    opening_hour TIME NOT NULL DEFAULT '07:00',
    closing_hour TIME NOT NULL DEFAULT '20:00',
    default_session_duration_minutes INT NOT NULL DEFAULT 50,
    cancellation_notice_hours INT NOT NULL DEFAULT 4,
    max_replacements_per_month INT NOT NULL DEFAULT 2,
    birthday_message_template TEXT NOT NULL,
    leap_year_feb29_rule VARCHAR(10) NOT NULL DEFAULT 'feb28',
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Recife',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.2 Perfis de Usuários & Profissionais (RBAC)
```sql
CREATE TYPE user_role AS ENUM ('admin', 'receptionist', 'professional');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'professional',
    council_registration VARCHAR(50), -- e.g. CREFITO 245198-F
    specialty VARCHAR(150),
    color_hex VARCHAR(10) DEFAULT '#426B5B',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    working_hours JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.3 Pacientes
```sql
CREATE TYPE patient_status AS ENUM ('ativo', 'inativo', 'arquivado');

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    phone VARCHAR(20) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address JSONB NOT NULL,
    emergency_contact JSONB NOT NULL,
    modality VARCHAR(50) NOT NULL DEFAULT 'Pilates',
    responsible_professional_id UUID REFERENCES profiles(id),
    status patient_status NOT NULL DEFAULT 'ativo',
    administrative_notes TEXT,
    clinical_alerts TEXT[],
    active_plan_id UUID,
    sessions_total INT NOT NULL DEFAULT 0,
    sessions_completed INT NOT NULL DEFAULT 0,
    sessions_remaining INT NOT NULL DEFAULT 0,
    sessions_cancelled INT NOT NULL DEFAULT 0,
    sessions_replaced INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_clinic_status ON patients(clinic_id, status);
CREATE INDEX idx_patients_birthdate ON patients(birth_date);
```

### 1.4 Planos e Contratos
```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    price_cents BIGINT NOT NULL, -- Valor em centavos para evitar ponto flutuante
    sessions_count INT NOT NULL,
    frequency_per_week INT NOT NULL,
    validity_days INT NOT NULL DEFAULT 30,
    duration_minutes INT NOT NULL DEFAULT 50,
    replacement_conditions TEXT,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.5 Agendamentos Individuais (Prevenção de Conflitos no Banco)
```sql
CREATE TYPE appointment_status AS ENUM (
    'agendado', 'confirmado', 'em_atendimento', 'realizado', 'cancelado', 'faltou', 'reagendado'
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    professional_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    modality VARCHAR(50) NOT NULL DEFAULT 'Pilates',
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 50,
    status appointment_status NOT NULL DEFAULT 'agendado',
    is_recurrent BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_id UUID,
    cancellation_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint de não sobreposição para o mesmo profissional (Exclusão no Postgres)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING gist (
    professional_id WITH =,
    appointment_date WITH =,
    tsrange(
        (appointment_date + start_time),
        (appointment_date + end_time)
    ) WITH &&
) WHERE (status NOT IN ('cancelado', 'reagendado'));
```

### 1.6 Módulo Financeiro (Centavos & Múltiplos Recebimentos)
```sql
CREATE TYPE financial_status AS ENUM (
    'pendente', 'pago', 'parcialmente_pago', 'vencido', 'cancelado', 'estornado'
);

CREATE TYPE payment_method AS ENUM (
    'pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'transferencia'
);

CREATE TABLE charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    description VARCHAR(255) NOT NULL,
    original_amount_cents BIGINT NOT NULL,
    discount_cents BIGINT NOT NULL DEFAULT 0,
    surcharge_cents BIGINT NOT NULL DEFAULT 0,
    final_amount_cents BIGINT NOT NULL,
    paid_amount_cents BIGINT NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status financial_status NOT NULL DEFAULT 'pendente',
    category VARCHAR(50) NOT NULL DEFAULT 'mensalidade',
    plan_id UUID REFERENCES plans(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charge_id UUID NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    method payment_method NOT NULL,
    receipt_number VARCHAR(100),
    received_by UUID NOT NULL REFERENCES profiles(id),
    notes TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount_cents BIGINT NOT NULL,
    due_date DATE NOT NULL,
    payment_date DATE,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_method payment_method,
    beneficiary VARCHAR(255) NOT NULL,
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE financial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charge_id UUID REFERENCES charges(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.7 Catálogo de Exercícios & Planejamento Semanal
```sql
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    equipment VARCHAR(50) NOT NULL,
    body_region VARCHAR(100) NOT NULL,
    objective TEXT NOT NULL,
    short_description TEXT NOT NULL,
    instructions TEXT[] NOT NULL,
    variations TEXT[],
    contraindications TEXT[],
    steps JSONB NOT NULL,
    video_url TEXT,
    reviewed_by_professional BOOLEAN NOT NULL DEFAULT TRUE,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    professional_goal TEXT NOT NULL,
    created_by_id UUID NOT NULL REFERENCES profiles(id),
    weekly_days JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.8 Atendimentos & Prontuário Clínico (Imutabilidade & Adendos)
```sql
CREATE TABLE clinical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
    anamnesis JSONB NOT NULL DEFAULT '{}'::jsonb,
    initial_evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clinical_evolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    attendance_id UUID,
    professional_id UUID NOT NULL REFERENCES profiles(id),
    professional_council VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    adendums JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 2. Políticas de Segurança (Row Level Security - RLS)

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_evolutions ENABLE ROW LEVEL SECURITY;

-- Exemplo: Pacientes visíveis apenas para membros da mesma clínica
CREATE POLICY clinic_isolation_patients ON patients
FOR ALL USING (
    clinic_id IN (
        SELECT clinic_id FROM profiles WHERE profiles.id = auth.uid()
    )
);

-- Prontuários e evoluções clínicas restritos a profissionais habilitados e administradores
CREATE POLICY clinical_privacy_records ON clinical_records
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'professional')
    )
);
```
