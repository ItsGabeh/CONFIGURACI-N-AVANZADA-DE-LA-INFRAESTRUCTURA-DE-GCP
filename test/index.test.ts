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

    beforeEach(() => {
        // Configuracion utilizada durante las pruebas
        process.env.WEB_APP_URL = "https://example.com/webhook";
        process.env.WEBHOOK_SECRET = "test-secret";
    });

    // Después de cada prueba restaura los spies creados por Sinon
    afterEach(() => {
        sinon.restore();

        delete process.env.WEB_APP_URL;
        delete process.env.WEBHOOK_SECRET;
    });


    it("Evento valido de Cloud Storage", async () => {
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
                timeCreated: new Date().toISOString(),
            },
        };

        // Simular respuesta correcta de Apps Script
        const fetchStub = sinon.stub(globalThis, "fetch").resolves(
            new Response(
                JSON.stringify({
                    success: true,
                    message: "Archivo registrado"
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            )
        );

        // Crear un spy sobre console.log
        const logSpy = sinon.spy(console, "log");

        await onArchivoSubido(event);

        // Verificar que se registraron los datos del archivo
        assert.equal(
            logSpy.calledWith(
                "[test-bucket] Archivo recibido: Nombre archivo-prueba.pdf, Tamaño: 1024, Tipo: application/pdf"
            ),
            true
        );

        // Verificar que se realizó la petición a Apps Script
        assert.equal(fetchStub.calledOnce, true);
    });


    it("Evento que genera un error cuando el evento no contiene data", async () => {
        // Evento falso que simula el evento enviado por
        // Cloud Storage pero no tiene el objeto data
        const event: CloudEvent<StorageObjectData> = {
            specversion: "1.0",
            id: "evento-test-002",
            source: "//storage.googleapis.com/projects/_/buckets/test-bucket",
            type: "google.cloud.storage.object.v1.finalized",
        };

        // Spy sobre console.error
        const errorSpy = sinon.spy(console, "error");

        // Comprobar que la función lanza el error esperado
        await assert.rejects(
            onArchivoSubido(event),
            /\[ERROR\] el evento no contiene datos/
        );

        // Comprobar que el error también fue registrado en console.error
        assert.equal(
            errorSpy.calledWith("[ERROR] el evento no contiene datos"),
            true
        );
    });


    it("Evento que genera un error cuando el archivo no contiene nombre", async () => {
        const event: CloudEvent<StorageObjectData> = {
            specversion: "1.0",
            id: "evento-test-003",
            source: "//storage.googleapis.com/projects/_/buckets/test-bucket",
            type: "google.cloud.storage.object.v1.finalized",
            data: {
                bucket: "test-bucket",
                size: 1024,
                contentType: "application/pdf",
                timeCreated: new Date().toISOString(),
            },
        };

        const errorSpy = sinon.spy(console, "error");

        await assert.rejects(
            onArchivoSubido(event),
            /Error: el evento no contiene un nombre de archivo/
        );

        assert.equal(
            errorSpy.calledWith(
                "[test-bucket] Error: el evento no contiene un nombre de archivo"
            ),
            true
        );
    });


    it("Genera error cuando WEBHOOK_SECRET no esta configurado", async () => {
        delete process.env.WEBHOOK_SECRET;

        const event: CloudEvent<StorageObjectData> = {
            specversion: "1.0",
            id: "evento-test-004",
            source: "//storage.googleapis.com/projects/_/buckets/test-bucket",
            type: "google.cloud.storage.object.v1.finalized",
            data: {
                bucket: "test-bucket",
                name: "archivo-prueba.pdf",
                size: 1024,
                contentType: "application/pdf",
                timeCreated: new Date().toISOString(),
            },
        };

        const errorSpy = sinon.spy(console, "error");

        await assert.rejects(
            onArchivoSubido(event),
            /WEBHOOK_SECRET no está configurado/
        );

        assert.equal(
            errorSpy.calledWith(
                "[ERROR] WEBHOOK_SECRET no está configurado"
            ),
            true
        );
    });


    it("Envia los metadatos, timestamp y firma a Apps Script", async () => {
        const event: CloudEvent<StorageObjectData> = {
            specversion: "1.0",
            id: "evento-test-005",
            source: "//storage.googleapis.com/projects/_/buckets/test-bucket",
            type: "google.cloud.storage.object.v1.finalized",
            data: {
                bucket: "test-bucket",
                name: "reporte.pdf",
                size: 2048,
                contentType: "application/pdf",
                timeCreated: "2026-10-01T15:00:00.000Z",
            },
        };

        const fetchStub = sinon.stub(globalThis, "fetch").resolves(
            new Response(
                JSON.stringify({
                    success: true
                }),
                {
                    status: 200
                }
            )
        );

        await onArchivoSubido(event);

        assert.equal(fetchStub.calledOnce, true);

        // Obtener los argumentos enviados a fetch
        const [url, options] = fetchStub.firstCall.args;

        assert.equal(
            url,
            "https://example.com/webhook"
        );

        assert.equal(
            options?.method,
            "POST"
        );

        const body = JSON.parse(
            options?.body as string
        );

        // Comprobar los metadatos enviados
        assert.equal(
            body.payload.eventId,
            "evento-test-005"
        );

        assert.equal(
            body.payload.bucket,
            "test-bucket"
        );

        assert.equal(
            body.payload.name,
            "reporte.pdf"
        );

        assert.equal(
            body.payload.size,
            2048
        );

        // Comprobar que se generaron los datos de seguridad
        assert.equal(
            typeof body.timestamp,
            "number"
        );

        assert.equal(
            typeof body.signature,
            "string"
        );

        assert.equal(
            body.signature.length,
            64
        );
    });


    it("Genera error cuando Apps Script responde con error HTTP", async () => {
        const event: CloudEvent<StorageObjectData> = {
            specversion: "1.0",
            id: "evento-test-006",
            source: "//storage.googleapis.com/projects/_/buckets/test-bucket",
            type: "google.cloud.storage.object.v1.finalized",
            data: {
                bucket: "test-bucket",
                name: "archivo-error.pdf",
                size: 1024,
                contentType: "application/pdf",
                timeCreated: new Date().toISOString(),
            },
        };

        sinon.stub(globalThis, "fetch").resolves(
            new Response(
                JSON.stringify({
                    success: false,
                    message: "Firma invalida"
                }),
                {
                    status: 500
                }
            )
        );

        const errorSpy = sinon.spy(console, "error");

        await assert.rejects(
            onArchivoSubido(event),
            /Apps Script respondió con HTTP 500/
        );

        assert.equal(
            errorSpy.called,
            true
        );
    });
});