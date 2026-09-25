-- Migração: permite o mesmo astronauta aparecer em mais de um final no ranking.
-- Executar no SQL Editor do projeto Supabase (supabase.com > seu projeto > SQL Editor).
-- Este script é idempotente: pode rodar mais de uma vez sem quebrar.
--
-- ANTES: a tabela `ranking` guardava 1 linha por NOME — ao fazer um novo final,
-- o resultado antigo era sobrescrito (ex.: o Breno do Final 4 virou o Breno do
-- Final 2, perdendo o lugar do Final 4).
-- DEPOIS: 1 linha por (NOME + FINAL) — o nick pode ficar no pódio dos 4 finais,
-- com a melhor partida de cada um. No ranking GLOBAL, cada nick conta uma vez
-- (a melhor partida), deduplicado pelo próprio jogo.

-- 1) Remove a unicidade antiga por nome (libera o mesmo nome para vários finais).
drop index if exists public.ranking_nome_unico_idx;

-- 2) Unicidade nova: por nome E final.
create unique index if not exists ranking_nome_final_unico_idx
on public.ranking ((upper(btrim(nome))), final_id);

-- 3) Atualiza o upsert para gravar em (nome, final) em vez de sobrescrever o nome.
create or replace function public.salvar_ranking(
  p_nome text, p_personagem_id text, p_tempo_segundos integer,
  p_mortes integer, p_moedas integer, p_final_id text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  nome_normalizado text := upper(btrim(p_nome));
begin
  if nome_normalizado is null or char_length(nome_normalizado) not between 1 and 20
     or p_personagem_id is null or p_personagem_id not in ('astronaut', 'space-lizard', 'ocstronaut')
     or p_tempo_segundos is null or p_tempo_segundos <= 0
     or p_mortes is null or p_mortes < 0
     or p_moedas is null or p_moedas < 0
     or p_final_id is null or char_length(p_final_id) not between 1 and 32 then
    raise exception 'Resultado de ranking inválido';
  end if;

  insert into public.ranking (nome, personagem_id, tempo_segundos, mortes, moedas, final_feito, final_id)
  values (nome_normalizado, p_personagem_id, p_tempo_segundos, p_mortes, p_moedas, true, p_final_id)
  on conflict ((upper(btrim(nome))), final_id) do update set
    nome = excluded.nome,
    personagem_id = excluded.personagem_id,
    tempo_segundos = excluded.tempo_segundos,
    mortes = excluded.mortes,
    moedas = excluded.moedas,
    final_feito = true,
    final_id = excluded.final_id,
    criado_em = now();
end;
$$;

revoke all on function public.salvar_ranking(text, text, integer, integer, integer, text) from public;
grant execute on function public.salvar_ranking(text, text, integer, integer, integer, text) to anon;

-- Observação: linhas antigas (anteriores à migração) continuam valendo — cada
-- nick mantém o final que estava na sua linha única na época. Os finais antigos
-- sobrescritos antes desta migração não podem ser recuperados.