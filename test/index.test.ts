import { strict as assert } from "node:assert";
import sinon from "sinon";

import { onArchivoSubido } from "../src/index.js";
import type { CloudEvent } from "@google-cloud/functions-framework";
import type { StorageObjectData } from "@google/events/cloud/storage/v1/StorageObjectData.js";

/**
 * Pruebas unitarias de la función onArchivoSubido.
 *
 * Se simulan eventos de Cloud Storage para comprobar el comportamiento
 * de la función sin necesidad de utilizar recursos reales de Google Cloud.
 *
 * Las pruebas verifican:
 * - El procesamiento correcto de un evento válido y el registro de los datos del archivo.
 * - El manejo de errores cuando el evento no contiene la información esperada.
 *
 * Sinon se utiliza para observar las llamadas a console.log y console.error,
 * mientras que las aserciones comprueban que los resultados sean los esperados.
 */
describe("onArchivoSubido", () => {
    // Después de cada prueba restaura los spies creados por Sinon
    afterEach(() => {
        sinon.restore();
    });

    it("Evento valido de Cloud Storage", () => {
        // Evento falso que simula el evento enviado por
        // Cloud Storage cuando se termina de subir un archivo
        const event: CloudEvent<StorageObjectData> = {
            specversion: "1.0",
            id: "test-event-id",
            source: "//storage.googleapis.com/projects/_/buckets/test-bucket",
            type: "google.cloud.storage.object.v1.finalized",
            time: new Date().toISOString(),
            data: {
                bucket: "test-bucket",
                name: "archivo-prueba.pdf",
                size: 1024,
                contentType: "application/pdf",
            },
        };

         // Crear un spy sobre console.log
        const logSpy = sinon.spy(console, "log");

        onArchivoSubido(event);
        // Verificar que console.log se haya ejecutado una sola vez
        assert.equal(logSpy.calledOnce, true);

        // Verificar que el mensaje registrado contiene exactamente
        // los datos del archivo simulado
        assert.equal(
            logSpy.calledWith(
                "[test-bucket] Archivo recibido: Nombre archivo-prueba.pdf, Tamaño: 1024, Tipo: application/pdf"
            ),
            true
        );
    });

    it("Evento que genera un error cuando el evento no contiene data", () => {
        // Evento falso que simula el evento enviado por
        // Cloud Storage pero no tiene el objeto data
        const event: CloudEvent<StorageObjectData> = {
            specversion: "1.0",
            id: "evento-test-002",
            source: "//storage.googleapis.com/projects/_/buckets/test-bucket",
            type: "google.cloud.storage.object.v1.finalized",
        };

        // Spy sobre console.log
        const errorSpy = sinon.spy(console, "error");

        // Comprobar que la función lanza el error esperado
        assert.throws(
            () => onArchivoSubido(event),
            /\[ERROR\] el evento no contiene datos/
        );

        // Comprobar que el error también fue registrado en console.error
        assert.equal(
            errorSpy.calledWith("[ERROR] el evento no contiene datos"),
            true
        );
    });
})