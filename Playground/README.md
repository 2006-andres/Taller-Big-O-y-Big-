# Ordenador de personas desde CSV o TXT

Esta solución incluye:

- Un backend en Python que recibe el contenido del archivo `.csv` o `.txt`, interpreta cada línea y ordena los registros por nombre.
- Un frontend donde puedes seleccionar el archivo y ver la información ordenada en una tabla.

## Cómo ejecutar

### Opción rápida en Windows

Haz doble clic en:

```text
iniciar_app.bat
```

Eso abre el navegador y arranca el servidor.

### Opción por terminal

1. Abre una terminal en esta carpeta.
2. Ejecuta:

```bash
python app.py
```

3. Abre en el navegador:

```text
http://127.0.0.1:8000
```

## Archivos listos para probar

- `ejemplo_personas.txt`: ejemplo en TXT.
- `personas_ejemplo.txt`: ejemplo simple de prueba.
- `lista_1000_contactos.csv`: copia local del archivo CSV real para pruebas.

## Formatos soportados

CSV con encabezados como:

```text
apellido1,nombre,apellido2,nombre2,Numcelular,correo,cedula
Flores,Daniela,Castro,Luis,3693229354,daniela.flores81@outlook.com,2206935649
```

TXT en formato libre por línea:

```text
Nombre: Ana Torres, Edad: 29, Correo: ana@email.com, Ciudad: Medellin
```

## Qué hace el backend

- Recibe el contenido del archivo desde el frontend.
- Separa cada línea como un registro de persona.
- Intenta identificar campos como nombre, edad, correo, teléfono, documento y ciudad.
- Si el archivo es CSV como tu lista real, arma `nombre_completo` usando `nombre + nombre2 + apellido1 + apellido2`.
- Ordena los registros alfabéticamente por `nombre_completo`.

## Archivo de prueba

Puedes usar [personas_ejemplo.txt](C:\Users\av751\OneDrive\Documentos\Playground\personas_ejemplo.txt) para validar el flujo.
