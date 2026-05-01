# ARIMA/SARIMA Forecasting App

Aplicación base para proyecto de Investigación de Operaciones con modelos ARIMA y SARIMA.

## 1. Inicialización del Proyecto

```bash
# Crear proyecto con Vite + React + TypeScript
npm create vite@latest arima-forecast-app -- --template react-ts

cd arima-forecast-app

# Instalar dependencias base
npm install

# Instalar dependencias del proyecto
npm install papaparse lucide-react

# Instalar tipos para PapaParse
npm install -D @types/papaparse

# Instalar y configurar Tailwind CSS
npm install -D tailwindcss@^3.4.0 postcss autoprefixer
npx tailwindcss init -p
```

## 2. Configuración de Tailwind

En `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

En `src/index.css` (reemplazar contenido):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 3. Configuración de TypeScript Estricto

En `tsconfig.json` asegúrate de tener:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## 4. Estructura de Carpetas

```
src/
├── components/          # Componentes de UI puros
│   ├── FileUploader.tsx
│   ├── DataPreviewTable.tsx
│   └── ErrorMessage.tsx
├── hooks/               # Lógica de negocio reutilizable
│   └── useCsvParser.ts
├── types/               # Definiciones TypeScript
│   └── csv.types.ts
├── utils/               # Utilidades y helpers
│   └── csvProcessor.ts
├── services/            # (Futuro) llamadas a API/BD
├── App.tsx
└── main.tsx
```

## 5. Ejecutar

```bash
npm run dev
```
