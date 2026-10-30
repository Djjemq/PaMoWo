-- Consultas de revisión (SQL Editor de Supabase o psql)

-- Reclamaciones pendientes con la frase original y la evaluación inicial
select rc.id, a.texto, e.total, rc.motivo, e.detalle
from reclamaciones rc join evaluaciones e on e.id=rc.evaluacion_id join respuestas a on a.id=e.respuesta_id
where rc.estado='pendiente' order by rc.creada;

-- Reclamaciones aceptadas = posibles falsos negativos (ampliar el conjunto de pruebas)
select v.idioma, v.infinitivo, t.nombre as tiempo, a.texto, e.total, rc.puntos_revisados
from reclamaciones rc join evaluaciones e on e.id=rc.evaluacion_id join respuestas a on a.id=e.respuesta_id
join retos r on r.id=a.reto_id join verbos v on v.id=r.verbo_id join tiempos t on t.id=r.tiempo_id
where rc.estado='aceptada';

-- Cobertura del catálogo: verbos con casillas sin cubrir
select v.idioma, v.infinitivo, count(distinct (c.tiempo_id,c.persona_id)) as casillas,
       (select count(*)*3 from tiempos t where t.idioma=v.idioma) as esperadas
from verbos v left join conjugaciones c on c.verbo_id=v.id group by v.id
having count(distinct (c.tiempo_id,c.persona_id)) < (select count(*)*3 from tiempos t where t.idioma=v.idioma);

-- Ranking de una partida (cambia el 1 por el id)
select j.nombre, coalesce(sum(p.puntos),0) as total from jugadores j left join v_puntos p on p.jugador_id=j.id where j.partida_id = 1 group by j.id order by total desc;
