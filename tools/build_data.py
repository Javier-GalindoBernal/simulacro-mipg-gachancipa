#!/usr/bin/env python3
"""Genera data/simulacro.json y data/simulacro.data.js desde las fuentes del vault MIPG.

Fuentes (rutas en el vault MIPG GACHANCIPA 2026 → Proyectos/Plan de Mejora MIPG 2026-2027):
  1. work/iteraciones-v7/cronograma-20260924/datos-cronograma.json
     Acciones, políticas y hitos con las FECHAS V7 reancladas al 28-sep-2026 y el líder V7.
  2. Outputs/simulacro-furag/simulacro-furag-2026-09-09.html  (constante SEED_PREGUNTAS)
     Página del formulario FURAG, situación y opciones del checklist por pregunta.

Uso:
  python3 tools/build_data.py RUTA_CRONOGRAMA_JSON RUTA_SIMULACRO_ANTERIOR_HTML

Reglas que respeta (CLAUDE.md del vault):
  - Ninguna cifra ni fecha se escribe a mano: todo sale de las dos fuentes.
  - Las fechas y el líder salen SIEMPRE de la fuente 1 (V7); de la fuente 2 solo se toma el
    contenido del formulario. El simulacro anterior traía fechas históricas superadas.
  - El script se detiene si los códigos de ambas fuentes no coinciden exactamente.
"""
import hashlib
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def sha(p: pathlib.Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def leer_seed(html: pathlib.Path) -> list:
    s = html.read_text(encoding="utf-8")
    marca = "const SEED_PREGUNTAS = "
    i = s.index(marca) + len(marca)
    seed, _ = json.JSONDecoder().raw_decode(s[i:])
    return seed


def main(cron_path: str, seed_path: str) -> None:
    cron_p, seed_p = pathlib.Path(cron_path), pathlib.Path(seed_path)
    d = json.loads(cron_p.read_text(encoding="utf-8"))
    seed = {x["codigo"]: x for x in leer_seed(seed_p)}

    codigos = {a["id"] for a in d["acciones"]}
    if codigos != set(seed):
        raise SystemExit(
            f"Los códigos no coinciden: solo cronograma={sorted(codigos - set(seed))[:5]} "
            f"solo simulacro={sorted(set(seed) - codigos)[:5]}"
        )

    prio = {"1. Crítica": 1, "2. Alta": 2, "3. Media": 3, "4. Baja": 4, "5. Condicionada": 5}
    acciones = []
    for a in sorted(d["acciones"], key=lambda x: (x["fecha_inicial"], x["id"])):
        s = seed[a["id"]]
        if a["prioridad"] not in prio:
            raise SystemExit(f"Prioridad desconocida: {a['prioridad']}")
        item = {
            "id": a["id"],
            "politica": a["politica_id"],
            "dimension": a["dimension"],
            "dependencia": a["dependencia_lider"],
            "inicio": a["fecha_inicial"],
            "fin": a["fecha_final"],
            "prioridad": prio[a["prioridad"]],
            "pregunta": a["pregunta"],
            "pagina": s.get("pagina"),
            "situacion": s.get("situacion"),
            "accion": a["accion"],
            "entregable": a["entregable"],
            "evidencia": a["evidencia_requerida"],
            "opciones": [[o["texto"], 1 if o.get("cumple_oficial") else 0] for o in s["opciones"]],
        }
        if a.get("depende_de"):
            item["condicionada_a"] = a["depende_de"]
        acciones.append(item)

    politicas = [
        {
            "codigo": p["codigo"],
            "nombre": p["politica"],
            "dimension": p["dimension"],
            "lider": p["lider"],
            "tratamiento": p["tratamiento"],
            "acciones": len(p["acciones_ids"]),
        }
        for p in d["politicas"]
    ]
    hitos = [
        {
            "id": h["id"],
            "fase": h["fase"],
            "actividad": h["actividad"],
            "dependencia": h["dependencia"],
            "inicio": h["inicio"],
            "fin": h["fin"],
            "entregable": h["entregable"],
            "nota": h.get("nota") or "",
        }
        for h in d["hitos"]
    ]

    out = {
        "meta": {
            "titulo": "Simulacro MIPG · Alcaldía de Gachancipá",
            "corte_datos": d["corte"],
            "plan_inicio": d["inicio"],
            "plan_fin": d["fin"],
            "acciones": len(acciones),
            "condicionadas": sum(1 for a in acciones if "condicionada_a" in a),
            "politicas": len(politicas),
            "fuentes": {
                "cronograma_v7": {"archivo": "datos-cronograma.json", "sha256": sha(cron_p)},
                "checklist_formulario": {"archivo": "simulacro-furag-2026-09-09.html", "sha256": sha(seed_p)},
            },
            "aviso": (
                "Datos de trabajo del plan de mejoramiento MIPG V7. El simulacro es una herramienta de "
                "autoevaluación interna: no reemplaza el reporte FURAG ni acredita cumplimiento; las "
                "evidencias las valida la Secretaría de Planeación y Servicios Públicos."
            ),
        },
        "politicas": politicas,
        "hitos": hitos,
        "acciones": acciones,
    }

    # Comprobaciones de coherencia antes de escribir nada.
    ids = [a["id"] for a in acciones]
    assert len(ids) == len(set(ids)) == 244, "se esperaban 244 acciones únicas"
    # 233 códigos de 3 letras + 3 dígitos y 11 transversales (EMI##) de 3 letras + 2 dígitos.
    assert all(re.fullmatch(r"[A-Z]{3}\d{2,3}", i) for i in ids), "código con formato inesperado"
    assert all(a["inicio"] <= a["fin"] for a in acciones), "fechas invertidas"
    assert all(a["opciones"] for a in acciones), "acción sin checklist"

    (RAIZ / "data").mkdir(exist_ok=True)
    js = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    (RAIZ / "data" / "simulacro.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    # .js clásico (no módulo): permite abrir index.html con doble clic, sin servidor.
    (RAIZ / "data" / "simulacro.data.js").write_text(
        "/* Generado por tools/build_data.py — no editar a mano. */\nwindow.SIMULACRO_DATA=" + js + ";\n",
        encoding="utf-8",
    )
    print(f"OK · {len(acciones)} acciones · {out['meta']['condicionadas']} condicionadas · "
          f"{len(politicas)} políticas · {len(hitos)} hitos · {d['inicio']} → {d['fin']}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
