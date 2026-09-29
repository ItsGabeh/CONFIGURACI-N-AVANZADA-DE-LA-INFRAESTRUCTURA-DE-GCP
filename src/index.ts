import { CloudEvent, cloudEvent } from "@google-cloud/functions-framework";
import { StorageObjectData } from '@google/events/cloud/storage/v1/StorageObjectData';

/**
 * Cloud Function que extrae datos del archivo (nombre, tamaño y tipo) y registra los eventos en Cloud Logging.
 * 
 * 
 * La función utiliza console.log() y console.error() para generar registros. 
 * Cloud Run captura automáticamente la salida estándar (stdout) y de error (stderr) de la función
 * y envía estos registros a Cloud Logging, donde pueden consultarse mediante el Explorador de registros.
 */
cloudEvent<StorageObjectData>("onArchivoSubido", (event: CloudEvent<StorageObjectData>) => {
    try {
        // Extraer la informacion del objeto data
        const file = event.data;

        if (!file) {
            throw new Error(`[ERROR] el evento no contiene datos`);
        }

        if (!file.name) {
            throw new Error(`[${file.bucket}] Error: el evento no contiene un nombre de archivo`);
        }

        const name = file.name;
        const size = file.size;
        const contentType = file.contentType;

        console.log(`[${file.bucket}] Archivo recibido: Nombre ${name}, Tamaño: ${size}, Tipo: ${contentType}`);

    } catch (error) {
        // Cualquier trhow dentro del bloque try terminará aquí
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`${msg}`);

        throw error;
    }
});