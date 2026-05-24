# Core Web Vitals

## Descripción técnica
Los Core Web Vitals son un conjunto de métricas definidas por Google para 
medir la experiencia del usuario en términos de rendimiento web. Se componen 
de tres métricas principales: LCP (Largest Contentful Paint), INP (Interaction 
to Next Paint) y CLS (Cumulative Layout Shift), cada una evaluando un aspecto 
distinto de la experiencia de carga, interactividad y estabilidad visual.

## Integrantes
- Valery Salas Vargas
- Jose Andrés Ortiz Marín


## Curso
ISW-521 – Programación en Ambiente Web I  
Universidad Técnica Nacional – Sede San Carlos  
2026 – II Cuatrimestre  
Docente: Bryan Miguel Chaves Salas

## Requisitos
- Navegador moderno (Chrome recomendado, versión 90 o superior)
- No requiere instalación de dependencias

## Instalación y ejecución
1. Clonar el repositorio
git clone https://github.com/JoseAndres0508/Investigacion-Demo-ISW521.git
2. Entrar a la carpeta del proyecto
cd investigacion-demo-isw521
3. Abrir el archivo index.html en el navegador
En Windows: doble clic sobre index.html
En Mac/Linux: open index.html

## Estructura del proyecto
investigacion-demo-isw521/
├── index.html        # Página principal de la demo
├── style.css         # Estilos de la interfaz
├── vitals.js         # Lógica de medición con PerformanceObserver
└── README.md         # Este archivo

## Temas demostrados
- Medición de LCP con PerformanceObserver
- Medición de INP de forma manual
- Demostración de CLS alto vs CLS corregido