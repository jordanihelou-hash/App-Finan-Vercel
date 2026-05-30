-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — Função RPC para vínculo de casais (bypassa RLS)
--
-- PROBLEMA: A policy "Members can view own couple" no Supabase impede que um
-- usuário consulte um casal que ainda não é o seu (mesmo passando um código de
-- convite). A query do lado cliente retorna null e o app interpreta como
-- "código inválido", quando na verdade o código existe mas o RLS bloqueou.
--
-- SOLUÇÃO: Uma função SECURITY DEFINER que roda com privilégios elevados,
-- realiza o lookup pelo código e executa o vínculo atomicamente (join +
-- atualização de perfil), retornando o coupleId ou null se o código não existir.
--
-- Execute este script em:
-- Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.join_couple_by_code(invite_code text)
returns uuid
language plpgsql
security definer          -- executa como owner (bypassa RLS)
set search_path = public  -- evita search_path injection
as $$
declare
  target_couple_id uuid;
  already_member   boolean;
begin
  -- 1. Lookup do casal pelo código (bypassa RLS graças ao security definer)
  select id
    into target_couple_id
    from public.couples
   where code = upper(trim(invite_code));

  -- Código não encontrado → retorna null (o cliente vai mostrar erro)
  if target_couple_id is null then
    return null;
  end if;

  -- 2. Verifica se o usuário já é membro (evita duplicata)
  select exists(
    select 1 from public.couple_members
     where couple_id = target_couple_id
       and user_id   = auth.uid()
  ) into already_member;

  if already_member then
    return target_couple_id; -- idempotente
  end if;

  -- 3. Adiciona o usuário ao casal
  insert into public.couple_members (couple_id, user_id)
  values (target_couple_id, auth.uid())
  on conflict do nothing;

  -- 4. Atualiza o couple_id no perfil do usuário
  update public.user_profiles
     set couple_id = target_couple_id
   where id = auth.uid();

  return target_couple_id;
end;
$$;

-- Garante que usuários autenticados podem chamar a função
grant execute on function public.join_couple_by_code(text) to authenticated;

-- Policy adicional: permite que usuários autenticados façam SELECT na tabela
-- couples para carregar os dados do casal APÓS o join (ex: buscar o code do
-- novo casal). A policy existente já cobre isso via get_my_couple_id(), que
-- após o update acima retornará o novo coupleId.
-- Nenhuma policy adicional é necessária aqui.
