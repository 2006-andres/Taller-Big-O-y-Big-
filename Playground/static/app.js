const fileInput = document.getElementById("fileInput");
const processButton = document.getElementById("processButton");
const statusMessage = document.getElementById("statusMessage");
const resultsBody = document.getElementById("resultsBody");
const totalBadge = document.getElementById("totalBadge");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#8a1c0f" : "#6d5b4b";
}

function renderRows(people) {
  if (!people.length) {
    resultsBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty">No se encontraron registros válidos.</td>
      </tr>
    `;
    totalBadge.textContent = "0 registros";
    return;
  }

  resultsBody.innerHTML = people
    .map(
      (person, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(person.nombre_completo)}</td>
          <td>${escapeHtml(person.nombre)}</td>
          <td>${escapeHtml(person.nombre2)}</td>
          <td>${escapeHtml(person.apellido1)}</td>
          <td>${escapeHtml(person.apellido2)}</td>
          <td>${escapeHtml(person.correo)}</td>
          <td>${escapeHtml(person.telefono)}</td>
          <td>${escapeHtml(person.documento)}</td>
        </tr>
      `,
    )
    .join("");

  totalBadge.textContent = `${people.length} registro${people.length === 1 ? "" : "s"}`;
}

async function processFile() {
  const file = fileInput.files?.[0];

  if (!file) {
    setStatus("Selecciona primero un archivo .csv o .txt.", true);
    return;
  }

  if (!file.name.toLowerCase().endsWith(".txt") && !file.name.toLowerCase().endsWith(".csv")) {
    setStatus("Solo se permiten archivos con extensión .csv o .txt.", true);
    return;
  }

  setStatus("Leyendo archivo y enviándolo al backend...");

  try {
    const content = await file.text();
    const response = await fetch("/api/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "No se pudo procesar el archivo.");
    }

    renderRows(data.personas || []);
    setStatus(`Archivo procesado correctamente. Total de registros: ${data.total}.`);
  } catch (error) {
    setStatus(error.message || "Ocurrió un error inesperado.", true);
  }
}

processButton.addEventListener("click", processFile);
