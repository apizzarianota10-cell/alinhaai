import React, { useEffect, useState } from 'react';
import { KeyRound, Trash2, UserPlus, Loader2 } from 'lucide-react';
import { addMember, getActiveClinicId, listMembers, removeMember } from '../../lib/cloud';
import { clinicStorage } from '../../lib/storage';
import { ROLE_LABELS } from '../../lib/utils';
import { UserRole } from '../../types';
import { useToast } from '../common/Toast';

type Member = Awaited<ReturnType<typeof listMembers>>[number];

/** Who can log into this clinic (cloud mode, admins only) */
export const TeamAccessPanel: React.FC = () => {
  const { showToast } = useToast();
  const clinicId = getActiveClinicId();
  const me = clinicStorage.getCurrentUser();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('professional');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!clinicId) return;
    try {
      setMembers(await listMembers(clinicId));
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [clinicId]);

  if (!clinicId) return null;

  const input = 'px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg';

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs space-y-4">
      <div>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#426B5B] dark:text-[#5A8E7A]" /> Acesso ao sistema
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
          A pessoa cria a conta na tela de login (com e-mail e senha) e você libera o acesso aqui, escolhendo o perfil.
        </p>
      </div>

      <form
        className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await addMember(clinicId, email.trim(), role, name.trim());
            showToast(`Acesso liberado para ${name.trim()}.`, 'success');
            setEmail('');
            setName('');
            load();
          } catch (err) {
            showToast((err as Error).message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className={input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className={input} type="email" placeholder="E-mail da conta" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <select className={input} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="professional">Profissional</option>
          <option value="receptionist">Recepção</option>
          <option value="admin">Administrador</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-2 text-xs font-bold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Liberar
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-[#64748B]">Carregando…</p>
      ) : (
        <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
          {members.map((m) => (
            <li key={m.user_id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold">{m.display_name}</p>
                <p className="text-[#64748B]">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#E9F1EC] dark:bg-[#1F332A] text-[#345648] dark:text-[#9CCBB8] font-semibold">
                  {ROLE_LABELS[m.role]}
                </span>
                {m.user_id !== me.id && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Remover o acesso de ${m.display_name}?`)) return;
                      try {
                        await removeMember(clinicId, m.user_id);
                        showToast('Acesso removido.', 'info');
                        load();
                      } catch (err) {
                        showToast((err as Error).message, 'error');
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                    aria-label={`Remover acesso de ${m.display_name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
