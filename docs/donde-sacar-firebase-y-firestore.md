# Dónde sacar la configuración de Firebase y Firestore

La app **ya tiene código** que usa Firestore (`src/firebase.ts`, `getFirestore`). Lo que necesitas es **crear la base de datos en la consola** y **rellenar** `firebase-applet-config.json` (o variables `VITE_FIREBASE_*` si las usas).

---

## 1. Por qué ves cosas “en gris” en Google Cloud (APIs)

- En **Google Cloud Console → APIs y servicios → Biblioteca**, “Cloud Firestore API” puede aparecer como **no habilitada** o poco usada.
- **Firestore en Firebase** no se configura solo habilitando APIs a mano: lo normal es crear la base desde **Firebase Console** (paso 2). Eso suele activar lo necesario automáticamente.
- Si quieres habilitar la API a mano: busca **“Cloud Firestore API”** y pulsa **Habilitar**. No sustituye crear la base en Firebase.

---

## 2. Crear Firestore (imprescindible)

1. Entra a **[Firebase Console](https://console.firebase.google.com)** y elige **tu proyecto**.
2. Menú izquierdo: **Build (Compilar) → Firestore Database**.
3. Si no existe base: **Crear base de datos**.
4. Elige **modo**:
   - **Modo de producción** (recomendado cuando ya tengas `firestore.rules` desplegadas).
   - O **modo de prueba** solo para pruebas muy cortas (expira reglas permisivas).
5. Elige **ubicación** (región). **No se puede cambiar** después sin migración.
6. Tras crearla, verás la pestaña **Datos**, **Reglas**, **Índices**, etc. Ahí ya no debería verse “vacío” como si no existiera el producto.

---

## 3. De dónde sale cada valor de `firebase-applet-config.json`

En Firebase: **⚙️ Configuración del proyecto** (engranaje junto al nombre del proyecto) → pestaña **General**.

Baja hasta **Tus aplicaciones**. Si no hay app **Web** (`</>`), pulsa **Agregar app → Web**, pon un nombre y **registrar app**.

Verás un objeto tipo `firebaseConfig` o campos sueltos. Mapeo:

| Campo en el JSON | Dónde está en Firebase |
|------------------|-------------------------|
| `apiKey` | `apiKey` del SDK |
| `authDomain` | `authDomain` (ej. `tuproyecto.firebaseapp.com`) |
| `projectId` | `projectId` |
| `storageBucket` | `storageBucket` (puede ser `…appspot.com` o `….firebasestorage.app`) |
| `messagingSenderId` | `messagingSenderId` |
| `appId` | `appId` (termina en `:web:…`) |
| `firestoreDatabaseId` | Casi siempre **`(default)`** si solo creaste **una** base Firestore estándar. Si en la consola creaste una base con **otro nombre**, ese nombre va aquí (entre comillas). |

Copia esos valores a **`firebase-applet-config.json`** en la raíz del repositorio (el que ya usa `src/firebaseConfig.ts`).

---

## 4. Reglas e índices (para que la app no falle al leer/escribir)

Desde la carpeta del proyecto (con Firebase CLI y proyecto enlazado):

```bash
npm run deploy:rules
```

O por partes:

```bash
npm run deploy:firestore-rules
npm run deploy:firestore-indexes
npm run deploy:storage
```

También puedes pegar el contenido de `firestore.rules` en **Firestore → Reglas → Editor** y publicar.

---

## 5. Comprobar qué tiene el repo ahora

En terminal:

```bash
npm run firebase:ayuda-config
```

Lista los valores actuales de `firebase-applet-config.json` y recuerda de dónde sacar cada uno.

---

## Si Storage sigue en `storage/unauthorized` con reglas ya desplegadas

En **Firebase Console → App Check → pestaña APIs**: si **Cloud Storage for Firebase** está en **Enforcement activado** y la app web no tiene App Check configurado, Firebase **deniega** las subidas.

**Solución rápida (desarrollo / hasta integrar reCAPTCHA):** en esa misma fila de Storage, cambia enforcement a **Sin aplicar** o **Solo supervisión** (no “Aplicar”).

---

## Resumen

1. **Firestore** = producto en **Firebase → Firestore Database** (crear base), no solo “una API en gris” en Google Cloud.  
2. **Credenciales web** = **Configuración del proyecto → General → tu app Web**.  
3. **`firestoreDatabaseId`** = en la práctica **`(default)`** salvo que uses base nombrada.  
4. **Reglas** = desplegar `firestore.rules` del repo.
