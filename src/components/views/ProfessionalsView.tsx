import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Edit,
  Shield,
  Clock,
  Phone,
  Mail,
  Award,
  CheckCircle2,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { Professional, UserRole } from '../../types';
import { ROLE_LABELS } from '../../lib/utils';
import { isCloudSession } from '../../lib/demo';
import { TeamAccessPanel } from './TeamAccessPanel';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';

export const ProfessionalsView: React.FC = () => {
  const { showToast } = useToast();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formCouncil, setFormCouncil] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('professional');
  const [formStart, setFormStart] = useState('08:00');
  const [formEnd, setFormEnd] = useState('18:00');

  useEffect(() => {
    const load = () => {
      setProfessionals(clinicStorage.getProfessionals());
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  const openNewModal = () => {
    setEditingProf(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('(81) 9');
    setFormSpecialty('Fisioterapeuta / Instrutor(a) de Pilates');
    setFormCouncil('CREFITO ');
    setFormRole('professional');
    setFormStart('08:00');
    setFormEnd('18:00');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Professional) => {
    setEditingProf(p);
    setFormName(p.name);
    setFormEmail(p.email);
    setFormPhone(p.phone);
    setFormSpecialty(p.specialty);
    setFormCouncil(p.councilRegistration);
    setFormRole(p.role);
    setFormStart(p.workingHours.start);
    setFormEnd(p.workingHours.end);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast('Nome e e-mail são obrigatórios', 'error');
      return;
    }
    if (formEnd <= formStart) {
      showToast('O término do expediente deve ser depois do início.', 'error');
      return;
    }
    const emailTaken = professionals.some(
      (p) => p.id !== editingProf?.id && p.email.toLowerCase() === formEmail.trim().toLowerCase()
    );
    if (emailTaken) {
      showToast('Já existe um profissional com este e-mail.', 'error');
      return;
    }

    // Editing keeps fields the form doesn't show (status, colour, days, lunch break)
    const profData: Professional = {
      ...editingProf,
      id: editingProf ? editingProf.id : `prof-${Date.now()}`,
      name: formName.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim(),
      specialty: formSpecialty.trim(),
      councilRegistration: formCouncil.trim(),
      role: formRole,
      status: editingProf?.status || 'ativo',
      color: editingProf?.color || (formRole === 'admin' ? '#426B5B' : formRole === 'professional' ? '#2563EB' : '#8B5CF6'),
      availableDays: editingProf?.availableDays || [1, 2, 3, 4, 5],
      workingHours: {
        ...editingProf?.workingHours,
        start: formStart,
        end: formEnd,
      },
    };

    clinicStorage.saveProfessional(profData);
    showToast('Profissional salvo com sucesso!', 'success');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
            Equipe e Perfis de Acesso (RBAC)
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Profissionais de saúde, corpo clínico, registro no CREFITO e controle de permissões.
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Profissional</span>
        </button>
      </div>

      {isCloudSession() && <TeamAccessPanel />}

      {/* Professionals Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {professionals.map((prof) => (
          <div
            key={prof.id}
            className="p-5 rounded-2xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm"
                  style={{ backgroundColor: prof.color }}
                >
                  {prof.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#17231D] dark:text-[#F1F5F3]">{prof.name}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase mt-0.5 inline-block ${
                      prof.role === 'admin'
                        ? 'bg-emerald-100 text-emerald-800'
                        : prof.role === 'professional'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {ROLE_LABELS[prof.role]}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    clinicStorage.saveProfessional({ ...prof, status: prof.status === 'ativo' ? 'inativo' : 'ativo' });
                    showToast(prof.status === 'ativo' ? `${prof.name} desativado(a) da agenda.` : `${prof.name} reativado(a).`, 'info');
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                    prof.status === 'ativo'
                      ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400'
                      : 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                  }`}
                  title="Ativar / desativar na agenda"
                >
                  {prof.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </button>
                <button
                  onClick={() => openEditModal(prof)}
                  className="p-1.5 rounded-lg border border-[#E5EAE7] dark:border-[#273830] text-slate-500 hover:bg-slate-50"
                  title="Editar"
                  aria-label={`Editar ${prof.name}`}
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="text-xs space-y-1 text-[#64748B] dark:text-[#94A3B8] pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <p className="font-medium text-[#17231D] dark:text-[#F1F5F3]">{prof.specialty}</p>
              {prof.councilRegistration && (
                <p className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>{prof.councilRegistration}</span>
                </p>
              )}
              <p className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Horário: {prof.workingHours.start} às {prof.workingHours.end}</span>
              </p>
              <p className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span>{prof.phone}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE / EDIT PROFESSIONAL MODAL */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingProf ? 'Editar Profissional' : 'Novo Profissional'}
          description="Atribua as credenciais e papel de acesso."
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Nome Completo *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">E-mail *</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Telefone</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Especialidade Clínica</label>
                <input
                  type="text"
                  value={formSpecialty}
                  onChange={(e) => setFormSpecialty(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Registro de Conselho (CREFITO)</label>
                <input
                  type="text"
                  value={formCouncil}
                  onChange={(e) => setFormCouncil(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Perfil de Acesso (RBAC)</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as UserRole)}
                className="w-full text-xs px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              >
                <option value="admin">Administrador (Controle Total & Gestão Geral)</option>
                <option value="receptionist">Recepcionista (Agenda & Módulo Financeiro)</option>
                <option value="professional">Profissional (Agenda, Atendimentos & Prontuários)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Início do Expediente</label>
                <input
                  type="time"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Término do Expediente</label>
                <input
                  type="time"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Salvar Profissional
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
