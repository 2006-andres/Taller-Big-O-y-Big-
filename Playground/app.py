from __future__ import annotations

import csv
import json
import io
import re
import unicodedata
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.casefold())
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def split_segments(line: str) -> list[str]:
    if ";" in line:
        segments = [segment.strip() for segment in line.split(";")]
    elif "," in line:
        segments = [segment.strip() for segment in line.split(",")]
    elif "|" in line:
        segments = [segment.strip() for segment in line.split("|")]
    else:
        segments = [segment.strip() for segment in re.split(r"\s{2,}|\t", line)]
    return [segment for segment in segments if segment]


def parse_key_value_line(line: str) -> dict[str, str] | None:
    segments = split_segments(line)
    key_values: dict[str, str] = {}

    for segment in segments:
        if ":" not in segment:
            return None
        key, value = segment.split(":", 1)
        key_values[key.strip()] = value.strip()

    return key_values or None


def identify_field(label: str) -> str:
    normalized = normalize_text(label)
    if any(alias in normalized for alias in ("nombre", "name", "persona")):
        return "nombre"
    if any(alias in normalized for alias in ("apellido", "lastname", "surname")):
        return "apellido"
    if any(alias in normalized for alias in ("edad", "age")):
        return "edad"
    if any(alias in normalized for alias in ("correo", "email", "mail")):
        return "correo"
    if any(alias in normalized for alias in ("telefono", "celular", "movil", "phone")):
        return "telefono"
    if any(alias in normalized for alias in ("documento", "dni", "cedula", "id")):
        return "documento"
    if any(alias in normalized for alias in ("ciudad", "city")):
        return "ciudad"
    return label.strip().lower().replace(" ", "_")


def parse_key_value_record(line: str, index: int) -> dict[str, str | int]:
    raw_values = parse_key_value_line(line) or {}
    record: dict[str, str | int] = {"indice_original": index}

    for label, value in raw_values.items():
        field = identify_field(label)
        record[field] = value

    nombre = str(record.get("nombre", "")).strip()
    apellido = str(record.get("apellido", "")).strip()
    record["nombre_completo"] = " ".join(part for part in (nombre, apellido) if part).strip()
    if not record["nombre_completo"]:
        record["nombre_completo"] = f"Registro {index}"

    return record


def classify_free_segment(segment: str) -> tuple[str, str]:
    compact = segment.strip()
    if "@" in compact:
        return "correo", compact
    digits = re.sub(r"\D", "", compact)
    if compact.isdigit() and len(compact) <= 3:
        return "edad", compact
    if len(digits) >= 7:
        return "telefono", compact
    if compact.isdigit():
        return "documento", compact
    return "texto", compact


def parse_free_record(line: str, index: int) -> dict[str, str | int]:
    segments = split_segments(line)
    record: dict[str, str | int] = {"indice_original": index}
    text_parts: list[str] = []

    for segment in segments:
        field, value = classify_free_segment(segment)
        if field == "texto":
            text_parts.append(value)
            continue
        if field not in record:
            record[field] = value

    if text_parts:
        record["nombre_completo"] = text_parts[0]
        if len(text_parts) > 1:
            record["ciudad"] = text_parts[1]
    else:
        record["nombre_completo"] = f"Registro {index}"

    return record


def parse_people(text: str) -> list[dict[str, str | int]]:
    records: list[dict[str, str | int]] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    for index, line in enumerate(lines, start=1):
        if ":" in line:
            record = parse_key_value_record(line, index)
        else:
            record = parse_free_record(line, index)
        records.append(record)

    return sorted(
        records,
        key=lambda person: (
            normalize_text(str(person.get("nombre_completo", ""))),
            person.get("indice_original", 0),
        ),
    )


def row_value(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def parse_csv_people(text: str) -> list[dict[str, str | int]]:
    reader = csv.DictReader(io.StringIO(text))
    records: list[dict[str, str | int]] = []

    for index, row in enumerate(reader, start=1):
        nombre = row_value(row, "nombre", "first_name")
        nombre2 = row_value(row, "nombre2", "second_name")
        apellido1 = row_value(row, "apellido1", "last_name", "apellido")
        apellido2 = row_value(row, "apellido2", "second_last_name")

        nombre_completo = " ".join(
            part for part in (nombre, nombre2, apellido1, apellido2) if part
        ).strip()

        if not nombre_completo:
            nombre_completo = f"Registro {index}"

        records.append(
            {
                "indice_original": index,
                "nombre": nombre,
                "nombre2": nombre2,
                "apellido1": apellido1,
                "apellido2": apellido2,
                "nombre_completo": nombre_completo,
                "telefono": row_value(row, "Numcelular", "numcelular", "telefono", "phone"),
                "correo": row_value(row, "correo", "email", "mail"),
                "documento": row_value(row, "cedula", "documento", "dni", "id"),
            }
        )

    return sorted(
        records,
        key=lambda person: (
            normalize_text(str(person.get("nombre_completo", ""))),
            person.get("indice_original", 0),
        ),
    )


def looks_like_csv(text: str) -> bool:
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    normalized = normalize_text(first_line)
    return "," in first_line and any(
        header in normalized
        for header in ("apellido1", "nombre", "correo", "cedula", "numcelular")
    )


class AppHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        route = parsed.path

        if route == "/":
            self.serve_file(STATIC_DIR / "index.html", "text/html; charset=utf-8")
            return

        if route.startswith("/static/"):
            relative_path = route.removeprefix("/static/")
            file_path = (STATIC_DIR / relative_path).resolve()
            if not str(file_path).startswith(str(STATIC_DIR.resolve())) or not file_path.exists():
                self.send_error(HTTPStatus.NOT_FOUND, "Archivo no encontrado")
                return
            content_type = self.guess_content_type(file_path.suffix)
            self.serve_file(file_path, content_type)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Ruta no encontrada")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/process":
            self.send_error(HTTPStatus.NOT_FOUND, "Ruta no encontrada")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "El cuerpo debe estar en formato JSON valido."}, HTTPStatus.BAD_REQUEST)
            return

        text = str(payload.get("content", "")).strip()
        if not text:
            self.send_json({"error": "Debes enviar contenido dentro del archivo TXT."}, HTTPStatus.BAD_REQUEST)
            return

        sorted_people = parse_csv_people(text) if looks_like_csv(text) else parse_people(text)
        self.send_json(
            {
                "total": len(sorted_people),
                "personas": sorted_people,
            }
        )

    def serve_file(self, file_path: Path, content_type: str) -> None:
        data = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def guess_content_type(self, suffix: str) -> str:
        return {
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".html": "text/html; charset=utf-8",
            ".txt": "text/plain; charset=utf-8",
        }.get(suffix, "application/octet-stream")


def run() -> None:
    host = "127.0.0.1"
    port = 8000
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Servidor disponible en http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
