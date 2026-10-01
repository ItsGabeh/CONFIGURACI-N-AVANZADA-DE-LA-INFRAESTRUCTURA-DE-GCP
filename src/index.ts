import { type CloudEvent, cloudEvent } from "@google-cloud/functions-framework";
import type { StorageObjectData } from "@google/events/cloud/storage/v1/StorageObjectData.js";
import { createHmac } from "node:crypto";

/**
 * Cloud Function que extrae datos del archivo (nombre, tamaño y tipo) y registra los eventos en Cloud Logging.
 * 
 * 
 * La función utiliza console.log() y console.error() para generar registros. 
 * Cloud Run captura automáticamente la salida estándar (stdout) y de error (stderr) de la función
 * y envía estos registros a Cloud Logging, donde pueden consultarse mediante el Explorador de registros.
 * 
 * NOTA: modificacion para el reto del dia 3: Toma los datos del archivo
 * y los manda a una web app de Apps Script mediante HTTP.
 */
export async function onArchivoSubido(event: CloudEvent<StorageObjectData>) {
    try {
        // Extraer la informacion del objeto data
        const file = event.data;

        // Typescript obliga a manejar el undefined tipado en el event.data
        if (!file) {
            throw new Error(`[ERROR] el evento no contiene datos`);
        }

        // Validar los datos necesarios para enviar los metadatos
        if (!event.id) {
            throw new Error(`[ERROR] el evento no contiene un ID`);
        }
        
        if (!file.bucket) {
            throw new Error(`[ERROR] el evento no contiene un bucket`);
        }

        // En caso de que un archivo llege sin nombre
        if (!file.name) {
            throw new Error(`[${file.bucket}] Error: el evento no contiene un nombre de archivo`);
        }

        if (file.size === undefined) {
            throw new Error(`[${file.bucket}] Error: el evento no contiene el tamaño del archivo`);
        }

        if (!file.contentType) {
            throw new Error(`[${file.bucket}] Error: el evento no contiene el tipo de archivo`);
        }

        if (!file.timeCreated) {
            throw new Error(`[${file.bucket}] Error: el evento no contiene la fecha de creación`);
        }

        const name = file.name;
        const size = file.size;
        const contentType = file.contentType;

        console.log(`[${file.bucket}] Archivo recibido: Nombre ${name}, Tamaño: ${size}, Tipo: ${contentType}`);

        // Obtener la configuracion
        const webAppUrl = process.env.WEB_APP_URL;
        const webhookSecret = process.env.WEBHOOK_SECRET;

        if (!webAppUrl) {
            throw new Error(`[ERROR] WEB_APP_URL no está configurada`);
        }

        if (!webhookSecret) {
            throw new Error(`[ERROR] WEBHOOK_SECRET no está configurado`);
        }

        // Crear los datos que se enviaran a Apps Script
        const payload = {
            eventId: event.id,
            bucket: file.bucket,
            name: file.name,
            contentType: file.contentType,
            size: file.size,
            timeCreated: file.timeCreated
        };

        // Crear el timestamp y la firma
        const timestamp = Date.now();
        const message = `${timestamp}.${JSON.stringify(payload)}`;

        const signature = createHmac("sha256", webhookSecret)
            .update(message)
            .digest("hex");

        // Crear el cuerpo de la peticion
        const requestBody = {
            timestamp,
            payload,
            signature
        };

        console.log(`[${file.bucket}] Enviando metadatos a Apps Script`);

        // Enviar los metadatos a la Web App
        const response = await fetch(webAppUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(10000)
        });

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(
                `[${file.bucket}] Apps Script respondió con HTTP ${response.status}: ${responseText}`
            );
        }

        console.log(`[${file.bucket}] Respuesta de Apps Script: ${responseText}`);

    } catch (error) {
        // Cualquier trhow dentro del bloque try terminará aquí
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`${msg}`);

        // Hacer que la ejecucion falle al final a proposito, evita que se interprete como un proceso sin errores
        throw error;
    }
}

cloudEvent<StorageObjectData>("onArchivoSubido", onArchivoSubido);