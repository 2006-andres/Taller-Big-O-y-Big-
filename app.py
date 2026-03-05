from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/upload', methods=['POST'])
def upload_file():
    file = request.files['file']
    
    personas = []

    for linea in file:
        linea = linea.decode('utf-8').strip()
        nombre, edad = linea.split(',')
        personas.append({
            "nombre": nombre,
            "edad": int(edad)
        })

    # Ordenar por nombre
    personas.sort(key=lambda x: x["nombre"])

    return jsonify(personas)

if __name__ == '__main__':
    app.run(debug=True)