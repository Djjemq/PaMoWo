-- Juego de idiomas · esquema PostgreSQL (compatible con Supabase)

-- 1) CATÁLOGO
create table idiomas(codigo text primary key, nombre text not null);
create table tiempos(id serial primary key, idioma text not null references idiomas, orden int not null, nombre text not null, unique(idioma,orden), unique(idioma,nombre));
create table personas(id serial primary key, idioma text not null references idiomas, orden int not null, codigo text not null, pronombre text not null, unique(idioma,codigo));
create table verbos(id serial primary key, idioma text not null references idiomas, infinitivo text not null, irregular boolean not null, fuente text not null default 'prueba', unique(idioma,infinitivo));
-- varias formas válidas por casilla (p. ej. «est allé» / «est allée»); 'principal' = la sugerida
create table conjugaciones(verbo_id int not null references verbos on delete cascade, tiempo_id int not null references tiempos, persona_id int not null references personas, forma text not null, principal boolean not null default false, primary key(verbo_id,tiempo_id,persona_id,forma));

-- 2) PARTIDAS
create table partidas(id serial primary key, codigo text not null unique default substr(md5(random()::text),1,6), idioma_practica text not null references idiomas, idioma_ui text not null references idiomas, nivel int not null check(nivel between 1 and 4), tiempos_elegidos int[] not null check(cardinality(tiempos_elegidos)>0), estado text not null default 'en_curso', creada timestamptz not null default now());
create table jugadores(id serial primary key, partida_id int not null references partidas on delete cascade, orden int not null, nombre text not null, unique(partida_id,orden));
create table rondas(id serial primary key, partida_id int not null references partidas on delete cascade, numero int not null, unique(partida_id,numero));
create table retos(id serial primary key, ronda_id int not null references rondas on delete cascade, jugador_id int not null references jugadores, posicion int not null check(posicion between 1 and 3), verbo_id int not null references verbos, tiempo_id int not null references tiempos, persona_id int not null references personas, unique(ronda_id,jugador_id,posicion));

-- 3) RESPUESTAS: la frase original NUNCA se modifica
create table respuestas(id serial primary key, reto_id int not null unique references retos on delete cascade, texto text not null check(length(trim(texto))>0), creada timestamptz not null default now());
create function respuestas_inmutables() returns trigger language plpgsql as $$
begin
  if new.texto is distinct from old.texto then raise exception 'La respuesta original no se puede modificar'; end if;
  return new;
end $$;
create trigger t_inmutable before update on respuestas for each row execute function respuestas_inmutables();

-- 4) EVALUACIONES: criterios 0/1; el TOTAL lo calcula la base de datos
create table evaluaciones(id serial primary key, respuesta_id int not null references respuestas on delete cascade, evaluador text not null, version int not null default 1,
  conjugacion smallint not null check(conjugacion in (0,1)), gramatica smallint not null check(gramatica in (0,1)),
  coherencia smallint not null check(coherencia in (0,1)), vocabulario smallint not null check(vocabulario in (0,1)),
  total smallint generated always as (conjugacion+gramatica+coherencia+vocabulario) stored,
  detalle jsonb not null default '{}', creada timestamptz not null default now(), unique(respuesta_id,evaluador,version));

-- 5) RECLAMACIONES
create table reclamaciones(id serial primary key, evaluacion_id int not null unique references evaluaciones, motivo text not null check(length(trim(motivo))>0),
  estado text not null default 'pendiente' check(estado in ('pendiente','aceptada','rechazada')),
  puntos_revisados smallint check(puntos_revisados between 0 and 4), notas text, creada timestamptz not null default now(), revisada timestamptz);

-- 6) PUNTOS por ronda y jugador (usa la puntuación revisada si la reclamación fue aceptada)
create view v_puntos as
select r.ronda_id, r.jugador_id, j.nombre, sum(coalesce(c.puntos_revisados,e.total))::int as puntos
from evaluaciones e join respuestas a on a.id=e.respuesta_id join retos r on r.id=a.reto_id join jugadores j on j.id=r.jugador_id
left join reclamaciones c on c.evaluacion_id=e.id and c.estado='aceptada'
where e.evaluador='reglas-v1' group by r.ronda_id,r.jugador_id,j.nombre;
