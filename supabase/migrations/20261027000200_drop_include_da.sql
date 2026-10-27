-- Day after é "nenhuma ação": nunca vira tarefa/evento, então a opção deixa de existir.
alter table public.profiles drop column include_da;
