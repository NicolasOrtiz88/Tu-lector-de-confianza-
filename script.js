document.addEventListener('DOMContentLoaded', () => {
  // FINAL MESSAGE DEFINITION
  // Aquí puedes editar el mensaje final.
  const FINAL_MESSAGE = {
    title: "Una última cosa",
    paragraphs: [
      "Quería dejarte este pequeño rincón porque me pareció la mejor forma de darte algo que realmente sintiera nuestro.",
      "Espero que te haya gustado."
    ],
    signature: "— N."
  };

  // Init Petals Animation
  initPetals();

  // State Management
  const visitedReader = localStorage.getItem('sof_visited_reader') === 'true';
  const visitedStory = localStorage.getItem('sof_visited_story') === 'true';
  
  // Elements
  const entryScreen = document.getElementById('entry-screen');
  const hubScreen = document.getElementById('hub-screen');
  const entryText1 = document.getElementById('entry-text-1');
  const entryText2 = document.getElementById('entry-text-2');
  const enterBtn = document.getElementById('enter-btn');
  const indexItems = document.querySelectorAll('.index-item');
  const indexContainer = document.getElementById('index-container');
  const starsDisplay = document.getElementById('stars-display');
  const unlockSection = document.getElementById('unlock-section');
  
  // Logic for Entry Sequence (Siempre mostrar para que se disfrute el misterio)
  // Play intro sequence
  setTimeout(() => {
    entryText1.classList.add('visible');
  }, 1000);

  setTimeout(() => {
    entryText2.classList.add('visible');
  }, 3500);

  setTimeout(() => {
    enterBtn.classList.add('visible');
  }, 5500);

  enterBtn.addEventListener('click', () => {
    entryScreen.style.opacity = '0';
    setTimeout(() => {
      entryScreen.classList.add('hidden');
      hubScreen.classList.remove('hidden');
      initHub();
    }, 1500);
  });

  function initHub() {
    // Update Stars
    let visitedCount = 0;
    if (visitedReader) visitedCount++;
    if (visitedStory) visitedCount++;

    if (visitedCount === 0) {
      starsDisplay.textContent = '✦   ✧';
    } else if (visitedCount === 1) {
      starsDisplay.textContent = '✦   ✦';
    } else {
      starsDisplay.textContent = '✦   ✦';
    }

    // Reveal Unlock Section always, so she doesn't miss it
    setTimeout(() => {
      unlockSection.classList.remove('hidden');
      
      setTimeout(() => {
        document.getElementById('unlock-text-1').classList.add('visible');
      }, 1000);
      
      setTimeout(() => {
        document.getElementById('unlock-spacer').classList.remove('hidden');
      }, 2500);

      setTimeout(() => {
        document.getElementById('unlock-text-2').classList.add('visible');
      }, 4000);

      setTimeout(() => {
        document.getElementById('unlock-btn').classList.add('visible');
      }, 5500);
    }, 6000);

    // Secuencia de entrada progresiva (siempre ocurre al cargar el Hub)
    setTimeout(() => {
      document.getElementById('intro-reveal').classList.remove('hidden');
    }, 1000);

    setTimeout(() => {
      if(indexItems[0]) indexItems[0].classList.remove('hidden');
    }, 2500);

    setTimeout(() => {
      if(indexItems[1]) indexItems[1].classList.remove('hidden');
    }, 3500);

    setTimeout(() => {
      starsDisplay.classList.remove('hidden');
    }, 4500);

    // Index Items Interaction & Navigation
    indexItems.forEach(item => {
      
      // Manejo táctil para comportamiento inmersivo en móviles
      item.addEventListener('touchstart', () => {
        // Limpiar estado activo de otros
        indexItems.forEach(other => other.classList.remove('active'));
        item.classList.add('active');
        indexContainer.classList.add('has-hover');
      }, { passive: true });

      // Efecto hover para desktop
      item.addEventListener('mouseenter', () => {
        indexContainer.classList.add('has-hover');
      });
      
      item.addEventListener('mouseleave', () => {
        indexContainer.classList.remove('has-hover');
        item.classList.remove('active'); // Limpiar estado si se sale
      });

      item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Add interaction effect for navigation
        item.style.transform = 'scale(0.98)';
        
        const targetUrl = item.getAttribute('data-target');
        const doorId = item.getAttribute('data-id');

        // Save state
        if (doorId === 'reader') localStorage.setItem('sof_visited_reader', 'true');
        if (doorId === 'story') localStorage.setItem('sof_visited_story', 'true');

        // Navigate after delay
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 600);
      });
    });

    // Limpiar estado inmersivo si toca fuera del contenedor
    document.addEventListener('touchstart', (e) => {
      if (!e.target.closest('.index-item')) {
        indexItems.forEach(item => item.classList.remove('active'));
        indexContainer.classList.remove('has-hover');
      }
    }, { passive: true });

    // Secret Message Interaction
    const unlockBtn = document.getElementById('unlock-btn');
    const modal = document.getElementById('secret-message-modal');
    const modalContent = document.getElementById('secret-message-content');
    const modalOverlay = document.getElementById('modal-overlay');

    if (unlockBtn) {
      unlockBtn.addEventListener('click', () => {
        // Build modal content
        modalContent.innerHTML = `
          <button class="close-modal" id="close-modal">&times;</button>
          <h3>${FINAL_MESSAGE.title}</h3>
          ${FINAL_MESSAGE.paragraphs.map(p => `<p>${p}</p>`).join('')}
          <p class="signature">${FINAL_MESSAGE.signature}</p>
        `;
        
        modal.classList.add('visible');

        document.getElementById('close-modal').addEventListener('click', () => {
          modal.classList.remove('visible');
        });
      });
    }

    if (modalOverlay) {
      modalOverlay.addEventListener('click', () => {
        modal.classList.remove('visible');
      });
    }

    // Seal Easter Egg
    const sealEgg = document.getElementById('seal-egg');
    const sealSpeech = document.getElementById('seal-speech');
    const sealImg = sealEgg.querySelector('.seal-img');
    let sealClickCount = 0;
    let sealTimeout;

    sealEgg.addEventListener('click', () => {
      sealClickCount++;
      clearTimeout(sealTimeout);
      
      sealSpeech.textContent = 'No estaba en los planes.';
      sealSpeech.classList.add('visible');
      
      // Animate seal slightly
      if(sealImg) {
        sealImg.style.transform = 'scale(1.2) rotate(10deg)';
        setTimeout(() => {
          sealImg.style.transform = 'scale(1) rotate(0deg)';
        }, 300);
      }

      sealTimeout = setTimeout(() => {
        sealSpeech.classList.remove('visible');
      }, 3000);
    });
  }

  // Petals Animation Generator
  function initPetals() {
    const container = document.createElement('div');
    container.className = 'petals-container';
    document.body.appendChild(container);

    const numPetals = 25; // Cantidad de pétalos simultáneos

    for (let i = 0; i < numPetals; i++) {
      const petal = document.createElement('div');
      petal.className = 'petal';
      
      // Random properties
      const size = Math.random() * 15 + 10; // 10px to 25px
      const left = Math.random() * 100; // 0vw to 100vw
      const animDuration = Math.random() * 12 + 8; // 8s to 20s caída lenta
      const animDelay = Math.random() * 15; // delay de entrada
      const rotate = Math.random() * 360;
      const scale = Math.random() * 0.5 + 0.5; // 0.5 to 1.0

      petal.style.width = `${size}px`;
      petal.style.height = `${size}px`;
      petal.style.left = `${left}vw`;
      
      // Pasar valores a CSS Vars
      petal.style.setProperty('--rot', `${rotate}deg`);
      petal.style.setProperty('--scale', scale);
      petal.style.animation = `fallingPetal ${animDuration}s ${animDelay}s linear infinite`;
      
      container.appendChild(petal);
    }
  }
});
