# 🚀 SPACE WAR: Videojuego Arcade Shooter (Proyecto Primer Bimestre)

**Materia:** Aplicaciones Web (2025B)
**Tipo de Proyecto:** Arcade Shooter Top-Down (HTML5 + Canvas + JavaScript)
**Autor:** Andres P. Fernandez. O

---

## 1. Ejecución del Juego (Build Jugable)

Este proyecto ha sido desarrollado con HTML5, Canvas y JavaScript modular. **No requiere de un servidor web** para su funcionamiento.

Para jugar, simplemente:

1.  Descomprime el archivo ZIP de entrega.
2.  Abre el archivo `index.html` en cualquier navegador web.

---

## 2. Controles de Juego

El juego está diseñado para ser controlado mediante teclado y ratón en un entorno de escritorio.

| Acción | Control (Teclado/Ratón) |
| :--- | :--- |
| **Mover a la Izquierda** | Flecha Izquierda (`←`) o Tecla **A** |
| **Mover a la Derecha** | Flecha Derecha (`→`) o Tecla **D** |
| **Disparar** | Barra Espaciadora (`Spacebar`) o Clic del Ratón |
| **Pausa/Reanudar** | Tecla **P** o Botón `||` en el HUD |
| **Silenciar Audio** | Botón de altavoz (`🔊`) en Menú o en el HUD del juego. |

---

## 3. Características Clave y Arquitectura (Análisis de Rúbrica)

El proyecto "SPACE WAR" fue desarrollado siguiendo una arquitectura modular para cumplir con los objetivos del bimestre.

### ⚙️ Arquitectura Técnica y Patrones

* **Base Visual (HTML5 Canvas):** El juego se renderiza completamente dentro del elemento `<canvas id="gamecanvas">`. Toda la lógica de dibujo (fondo, jugador, enemigos, balas) se gestiona directamente a través de la **API de Canvas 2D** en `game.js`.
* **Carga de Recursos (Loader):** El módulo `loader.js` es responsable de la **precarga asíncrona** de todas las imágenes (`player.png`, `enemy.png`, `bullet.png`, `background.png`) y recursos de audio antes de iniciar el juego.
* **Modularidad del Código (15% Rúbrica):** El proyecto divide responsabilidades en módulos dedicados: `game.js` (Lógica principal/Estados), `physics.js` (Integración de Box2D), y `loader.js` (Gestión de recursos/Audio).
* **Game Loop y Estados (25% Rúbrica):** Se implementa el ciclo de juego unificado (`drawLoop` en `game.js`) y se gestionan los estados requeridos: `menu`, `loading`, `playing`, `paused`, y `gameover`.
* **Motor de Física (Box2D):** El archivo `physics.js` inicializa el mundo **Box2D.js** para manejar todas las colisiones y el movimiento con precisión, garantizando la estabilidad del juego.

### ✅ Requisitos Cumplidos

| Requisito de Rúbrica | Implementación en "SPACE WAR" | Cumplimiento |
| :--- | :--- | :--- |
| **Física/Colisiones** | Uso de **Box2D.js** para colisiones circulares, manejando la interacción entre la nave del jugador, las balas, y los 3 tipos de enemigos. | **CUMPLIDO** |
| **Contenido/Mecánicas** | Implementación de **1 nivel con oleadas crecientes**. La dificultad sube mediante el **`difficultyFactor`** que aumenta la velocidad de los 3 tipos de enemigos y reduce el intervalo de spawn cada 4 segundos. | **CUMPLIDO** |
| **Audio** | Uso de la **Web Audio API** (`loader.js`). Incluye música de menú y **tres efectos de sonido** (`shoot`, `hit`, `gameover`), superando el mínimo requerido. | **CUMPLIDO** |
| **Rendimiento** | El bucle principal está optimizado para **$\geq 45$ FPS** (valor visible en el HUD con `fps-counter`), con manejo de `timeStep` para estabilidad física. | **CUMPLIDO** |
| **Persistencia** | Se utiliza **`localStorage`** para guardar y mostrar el **High Score** (Récord de Puntuación) en el panel de Récords del menú. | **CUMPLIDO** |
| **Accesibilidad** | La función **`toggleMute`** permite silenciar el audio globalmente desde el menú o el HUD, cumpliendo con el requisito de accesibilidad mínima. | **CUMPLIDO** |

---

## 4. Repositorio y Créditos

**Link al Repositorio Git:** **https://github.com/andresit02/Aplicaciones-Web**

---

## 5. Build Jugable (ZIP) + Capturas & Video

**Link de los archivos en la Nube:**

**https://epnecuador-my.sharepoint.com/:f:/g/personal/andres_fernandez01_epn_edu_ec/EhLTUoqxhjtHlZ2jZARWqfwBq_wRnLWL8ioUm5wayyOvQg?e=X4aifh**