# Eldara Paper Doll Inventory 🛡️

Un módulo visual e interactivo para gestionar el equipamiento físico de los personajes en **Foundry VTT**, diseñado específicamente para el sistema [Custom System Builder (CSB)](https://gitlab.com/custom-system-builder/custom-system-builder).

## ✨ Características Principales
* **Interfaz Visual Intuitiva:** Arrastra y suelta (Drag & Drop) ítems directamente desde la mochila del personaje a las ranuras corporales correspondientes sobre una silueta inmersiva.
* **Validación Estricta:** Sistema inteligente que impide equipar objetos en lugares incorrectos (ej. botas en la cabeza o dos escudos).
* **Mecánica de Armas a 2 Manos:** Detecta automáticamente espadones y mandobles, ocupando la mano secundaria de forma visual y desequipando objetos incompatibles.
* **Modo "Desarmado" Automático:** Si las manos del personaje quedan vacías, el sistema equipa el ítem de combate desarmado al instante.
* **Arquitectura de Última Generación:** Escrito sobre la nueva API `ApplicationV2` de Foundry V13 para un rendimiento óptimo y sin errores de consola.

## ⚙️ Instalación
Para añadir este módulo a tu mundo de Foundry VTT:
1. Abre Foundry VTT y navega a la pestaña de **Módulos Adicionales**.
2. Haz clic en el botón **Instalar Módulo**.
3. Pega el siguiente enlace en el campo de "URL del Manifiesto":
   `https://raw.githubusercontent.com/HectorReyes000/eldara-paper-doll/main/module.json`
4. Haz clic en Instalar, entra a tu mundo y activa el módulo en **Gestionar Módulos**.

## 🚀 Uso (Para Creadores en CSB)
Este módulo inyecta la clase `EldaraPaperDoll` de forma global. Para abrir la ventana desde una hoja de personaje de Custom System Builder, añade un componente tipo "Label" (marcado como botón) y pega el siguiente script de acción:

```javascript
%{
    if (window.EldaraPaperDoll) {
        new window.EldaraPaperDoll(entity).render(true);
    } else {
        ui.notifications.error("El módulo de Eldara Paper Doll no está activo.");
    }
}%
