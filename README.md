# 🚀 SPACE WAR: Videojuego Arcade Shooter (Proyecto Primer Bimestre)

**Materia:** Aplicaciones Web (2025B)
**Tipo de Proyecto:** Arcade Shooter Top-Down (HTML5 + Canvas + JavaScript)
**Autor:** [Andres P. Fernandez. O]

---

## 1. Ejecución del Juego (Build Jugable)

Este proyecto ha sido desarrollado con HTML5, Canvas y JavaScript modular. **No requiere de un servidor web** para su funcionamiento.

Para jugar, simplemente:

1.  Descomprime el archivo ZIP de entrega.
2.  Abre el archivo `index.html` en cualquier navegador web.
### Requisitos Mínimos

---

## 2. Controles de Juego

El juego ha sido diseñado para ser controlable en dispositivos de escritorio y táctiles, tal como se implementa en la función `handleInput` del código.

| Acción | Escritorio (Teclado) | Móvil/Táctil |
| :--- | :--- | :--- |
| **Mover a la Izquierda** | Flecha Izquierda (`←`) o Tecla **A** | Tocar el lado izquierdo de la pantalla. |
| **Mover a la Derecha** | Flecha Derecha (`→`) o Tecla **D** | Tocar el lado derecho de la pantalla. |
| **Disparar** | Barra Espaciadora (`Spacebar`) | Tocar el área central/superior de la pantalla (o mantener presionado). |
| **Pausa/Reanudar** | Botón `||` en el HUD o Tecla **P** | Botón `||` en el HUD. |
| **Silenciar Audio** | Botón de altavoz (`🔊`) en Menú o en el HUD del juego. | Botón de altavoz (`🔊`) en Menú o en el HUD del juego. |

---

## 3. Características Clave y Estructura

El proyecto cumple con los objetivos de la rúbrica y utiliza una arquitectura modular.

### ⚙️ Arquitectura Técnica

* **Game Loop & Estados:** El juego utiliza una estructura de bucle principal optimizada para **60 FPS** (según el código `game.js`) y maneja tres estados principales: `menu`, `playing` y `gameover`.
* **Motor de Física:** Integración de **Box2D.js** (versión minimizada) para manejar todas las colisiones de manera precisa entre la nave del jugador, enemigos y proyectiles, garantizando la estabilidad (archivo `physics.js`).
* **Carga de Recursos (Loader):** Se utiliza un módulo `loader.js` para la precarga asíncrona de todas las imágenes y audios antes de iniciar el juego.

### ✅ Requisitos Cumplidos

* **Persistencia:** Utiliza `localStorage` para guardar el **High Score** (Récord de Puntuación) y lo muestra en el panel de Récords del menú. (Líneas 10 y 310 en `game.js`).
* **Audio:** Implementación de la **Web Audio API** para manejar la reproducción, incluyendo música de menú y efectos de sonido (`shoot`, `hit`, `gameover`). El audio puede ser silenciado (`toggleMute`) globalmente desde el menú o el HUD, asegurando accesibilidad.
* **Rendimiento:** El juego incluye un contador de FPS (`fps-counter` en el HUD) para verificar que el rendimiento se mantiene en el rango requerido de **≥45 FPS**.
* **Contenido:** [Menciona aquí si tienes 3 niveles o 1 nivel con oleadas crecientes, según tu implementación.]

---

## 4. Repositorio y Créditos

**Link al Repositorio Git:** [https://github.com/andresit02/Aplicaciones-Web]

---

## 5. Build Jugable (ZIP)

**Link al Archivo ZIP en la Nube:**

[**https://epnecuador-my.sharepoint.com/:f:/g/personal/andres_fernandez01_epn_edu_ec/EhLTUoqxhjtHlZ2jZARWqfwBq_wRnLWL8ioUm5wayyOvQg?e=X4aifh**]