// =====================================
// VARIABLES GLOBALES
// =====================================
let currentUser = null;
let paymentStatus = false;
let examTaken = false;
let contactMessages = [];
let examTimer = null;
let examTimeLeft = 10800; // 3 horas en segundos (3 * 60 * 60)
let examQuestions = [];
let examApproved = false;

// =====================================
// INICIALIZACIÓN DESPUÉS DEL DOM
// =====================================
document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ Página cargada - Inicializando JavaScript");

  // Referencias del DOM
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userDisplay = document.getElementById("user-display");
  const loginModal = document.getElementById("login-modal");
  const closeModal = document.querySelector(".close-modal");
  const loginForm = document.getElementById("login-form");
  const payBtn = document.getElementById("pay-btn-fullstack");
  const contactForm = document.getElementById("contact-form");
  const examBtn = document.getElementById("exam-btn-fullstack");

  // Nuevas referencias para el examen
  const examModal = document.getElementById("exam-modal");
  const examTimerDisplay = document.getElementById("exam-timer");
  const examQuestionsContainer = document.getElementById("exam-questions");
  const submitExamBtn = document.getElementById("submit-exam-btn");
  const closeExamModal = document.querySelector(".close-exam-modal");

  // ===============================
  // CARGAR SESIÓN GUARDADA
  // ===============================
  loadSession();

  // ===============================
  // ABRIR / CERRAR MODAL DE LOGIN
  // ===============================
  if (loginBtn && loginModal) {
    loginBtn.addEventListener("click", function () {
      loginModal.style.display = "flex";
    });
  }

  if (closeModal) {
    closeModal.addEventListener("click", function () {
      loginModal.style.display = "none";
    });
  }

  // ===============================
  // LOGIN
  // ===============================
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const usuario = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      const result = await login(usuario, password);

      if (result.ok) {
        // Guardar usuario en sesión
        currentUser = { 
          cuenta: usuario,
          pago: result.data.user.pago // ← Esto viene del backend
        };
        paymentStatus = result.data.user.pago; // ← Estado real del backend

        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        localStorage.setItem("paymentStatus", paymentStatus.toString());
        localStorage.setItem("examTaken", examTaken.toString());

        if (userDisplay) userDisplay.textContent = usuario;
        if (loginBtn) loginBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-block";
        if (loginModal) loginModal.style.display = "none";

        showAlert("Acceso permitido", result.data.message, "success");
      } else {
        showAlert("Error", result.data.message, "error");
      }

      loginForm.reset();
    });
  }

  // ===============================
  // LOGOUT
  // ===============================
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      // Detener timer del examen si está activo
      if (examTimer) {
        clearInterval(examTimer);
        examTimer = null;
      }

      if (currentUser) await logoutBackend(currentUser.cuenta);

      currentUser = null;
      paymentStatus = false;
      examTaken = false;

      localStorage.removeItem("currentUser");
      localStorage.removeItem("paymentStatus");
      localStorage.removeItem("examTaken");

      if (userDisplay) userDisplay.textContent = "Invitado";
      if (loginBtn) loginBtn.style.display = "inline-block";
      if (logoutBtn) logoutBtn.style.display = "none";

      if (examBtn) {
        examBtn.disabled = true;
        examBtn.textContent = "Iniciar Examen";
        examBtn.classList.remove("btn-disabled", "btn-secondary");
        examBtn.classList.add("btn-secondary");
      }

      // Cerrar modal de examen si está abierto
      if (examModal) {
        examModal.style.display = "none";
      }

      showAlert("Sesión cerrada", "Has cerrado sesión correctamente", "info");
    });
  }

  // ===============================
  // PAGO DE CERTIFICACIÓN
  // ===============================
  if (payBtn) {
    payBtn.addEventListener("click", async function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (!currentUser) {
        showAlert("Acceso requerido", "Debe iniciar sesión para realizar el pago", "warning");
        return;
      }

      if (paymentStatus) {
        showAlert("Pago ya realizado", "Ya has pagado esta certificación", "info");
        return;
      }

      const confirmacion = await showConfirm(
        "Confirmar pago",
        "¿Está seguro de que desea pagar $3000 MX por la certificación de JavaScript?",
        "Pagar",
        "Cancelar"
      );

      if (confirmacion && confirmacion.isConfirmed) {
        try {
          if (typeof Swal !== 'undefined') {
            Swal.fire({
              title: 'Procesando pago...',
              text: 'Por favor espere',
              allowOutsideClick: false,
              didOpen: () => {
                Swal.showLoading();
              }
            });
          }

          const res = await fetch("http://localhost:3000/api/pago", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cuenta: currentUser.cuenta })
          });

          const data = await res.json();

          if (typeof Swal !== 'undefined') {
            Swal.close();
          }

          if (res.ok) {
            paymentStatus = true;
            localStorage.setItem("paymentStatus", "true");

            showAlert("Pago exitoso", data.message, "success");

            // Actualizar interfaz
            payBtn.textContent = "Pagado";
            payBtn.disabled = true;
            payBtn.classList.remove("btn-primary");
            payBtn.classList.add("btn-disabled");

            console.log(`✅ Pago completado para ${currentUser.cuenta}`);

            // Habilitar examen
            if (examBtn) {
              examBtn.disabled = false;
              examBtn.classList.remove("btn-disabled");
              examBtn.classList.add("btn-secondary");
              console.log("🧠 Examen habilitado para:", currentUser.cuenta);
            }
          } else {
            showAlert("Error en el pago", data.message, "error");
          }
        } catch (error) {
          console.error("Error al procesar el pago:", error);
          if (typeof Swal !== 'undefined') {
            Swal.close();
          }
          showAlert("Error de conexión", "Hubo un problema con el servidor.", "error");
        }
      }
    });
  }

  // ===============================
  // INICIAR EXAMEN - EN LA MISMA PÁGINA
  // ===============================
  if (examBtn) {
    examBtn.addEventListener("click", async function () {
      console.log("🎯 Botón de examen clickeado");
      
      if (!currentUser) {
        showAlert("Acceso requerido", "Debe iniciar sesión para realizar el examen", "warning");
        return;
      }

      if (!paymentStatus) {
        showAlert("Pago requerido", "Debe pagar la certificación antes de realizar el examen", "warning");
        return;
      }

      if (examTaken) {
        showAlert("Examen ya realizado", "El examen solo se puede aplicar una vez por usuario.", "warning");
        return;
      }

      const confirmacion = await showConfirm(
        "Iniciar Examen",
        "El examen tiene una duración de 3 horas. Se seleccionarán 8 preguntas aleatorias. ¿Estás lista para comenzar?",
        "Comenzar Examen",
        "Cancelar"
      );

      if (confirmacion && confirmacion.isConfirmed) {
        console.log("✅ Usuario confirmó inicio del examen");
        await startExam();
      } else {
        console.log("❌ Usuario canceló el examen");
      }
    });
  }

  // ===============================
  // FUNCIÓN PARA INICIAR EL EXAMEN
  // ===============================
  async function startExam() {
    try {
      // Cargar preguntas desde el backend
      console.log("📥 Cargando preguntas del servidor...");
      
      const res = await fetch("http://localhost:3000/api/preguntas");
      examQuestions = await res.json();
      
      console.log(`✅ ${examQuestions.length} preguntas cargadas`);

      // Marcar examen como iniciado
      examTaken = true;
      localStorage.setItem("examTaken", "true");

      // Actualizar botón de examen
      if (examBtn) {
        examBtn.disabled = true;
        examBtn.textContent = "Examen en Curso";
        examBtn.classList.remove("btn-secondary");
        examBtn.classList.add("btn-disabled");
      }

      try {
  const tiempoRes = await fetch("http://localhost:3000/api/examen/tiempo");
  const tiempoData = await tiempoRes.json();
  const minutosDesdeBack = tiempoData.minutos || 20; // valor por defecto si falla
  examTimeLeft = minutosDesdeBack * 60; // convertir a segundos
  console.log( 'Tiempo del examen obtenido del backend: ${minutosDesdeBack} minutos');
} catch (error) {
  console.error("⚠ No se pudo obtener el tiempo desde el backend, usando valor por defecto (3h).");
  examTimeLeft = 20 * 60;
}

updateExamTimer();

      // Iniciar el timer
      examTimer = setInterval(function() {
        examTimeLeft--;
        updateExamTimer();

        if (examTimeLeft <= 0) {
          clearInterval(examTimer);
          autoSubmitExam();
        }
      }, 1000);

      // Mostrar el modal del examen
      if (examModal) {
        loadExamQuestions();
        examModal.style.display = "flex";
      }

      console.log("🚀 Examen iniciado para:", currentUser.cuenta);
    } catch (error) {
      console.error("❌ Error al cargar preguntas:", error);
      showAlert("Error", "No se pudieron cargar las preguntas del examen", "error");
    }
  }

  // ===============================
  // CARGAR PREGUNTAS DEL EXAMEN
  // ===============================
  function loadExamQuestions() {
    if (!examQuestionsContainer) return;

    let questionsHTML = '';
    examQuestions.forEach((q, index) => {
      questionsHTML += `
        <div class="question" data-question-id="${q.id}">
          <h3>Pregunta ${index + 1}: ${q.texto}</h3>
          <div class="options">
            ${q.opciones.map(option => `
              <label class="option">
                <input type="radio" name="question-${q.id}" value="${option}">
                ${option}
              </label>
            `).join('')}
          </div>
        </div>
        <hr>
      `;
    });

    examQuestionsContainer.innerHTML = questionsHTML;
  }

  // ===============================
  // ACTUALIZAR TIMER DEL EXAMEN
  // ===============================
  function updateExamTimer() {
    if (!examTimerDisplay) return;

    const hours = Math.floor(examTimeLeft / 3600);
    const minutes = Math.floor((examTimeLeft % 3600) / 60);
    const seconds = examTimeLeft % 60;

    examTimerDisplay.textContent = 
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Cambiar color cuando quede poco tiempo
    if (examTimeLeft < 300) { // 5 minutos
      examTimerDisplay.style.color = 'red';
      examTimerDisplay.style.fontWeight = 'bold';
    }
  }

  // ===============================
  // ENVIAR EXAMEN
  // ===============================
  if (submitExamBtn) {
    submitExamBtn.addEventListener("click", async function() {
      await submitExam();
    });
  }

  // ===============================
  // ENVÍO AUTOMÁTICO AL TERMINAR EL TIEMPO
  // ===============================
  function autoSubmitExam() {
    showAlert("Tiempo agotado", "El tiempo del examen ha terminado. Se enviarán tus respuestas automáticamente.", "warning");
    submitExam();
  }

  // ===============================
  // CERRAR MODAL DE EXAMEN
  // ===============================
  if (closeExamModal) {
    closeExamModal.addEventListener("click", function() {
      if (examModal) {
        examModal.style.display = "none";
      }
    });
  }

  // ===============================
  // CONTACTO
  // ===============================
  if (contactForm) {
    contactForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const nombre = document.getElementById("name").value;
      const correo = document.getElementById("email").value;
      const mensaje = document.getElementById("message").value;

      const response = await enviarContactoBackend(nombre, correo, mensaje);

      showAlert("Mensaje Enviado", response.message, "success");

      contactMessages.push({ nombre, correo, mensaje });
      console.log("Mensajes de contacto:", contactMessages);

      contactForm.reset();
    });
  }

  // ===============================
  // CERRAR MODALES AL HACER CLIC FUERA
  // ===============================
  window.addEventListener("click", function (e) {
    if (loginModal && e.target === loginModal) {
      loginModal.style.display = "none";
    }
    if (examModal && e.target === examModal) {
      examModal.style.display = "none";
    }
  });

  // ===============================
  // BOTÓN IMPRIMIR CERTIFICADO
  // ===============================
  const btnImprimir = document.getElementById("btn-imprimir");
  if (btnImprimir) {
    btnImprimir.addEventListener("click", function() {
      if (currentUser && examApproved) {
        // Aquí puedes redirigir a una página de certificado o imprimir directamente
        window.print();
        console.log("📄 Imprimiendo certificado para:", currentUser.cuenta);
      } else {
        showAlert("Acceso denegado", "Debes aprobar el examen para imprimir tu certificado", "warning");
      }
    });
  }
});

// =====================================
// FUNCIÓN PARA ENVIAR EXAMEN
// =====================================
async function submitExam() {
  // Detener el timer
  if (examTimer) {
    clearInterval(examTimer);
    examTimer = null;
  }

  // Recopilar respuestas
  const answers = {};
  const questionElements = document.querySelectorAll('.question');
  
  questionElements.forEach(questionElement => {
    const questionId = questionElement.dataset.questionId;
    const selectedOption = questionElement.querySelector('input[type="radio"]:checked');
    
    if (selectedOption) {
      answers[questionId] = selectedOption.value;
    } else {
      answers[questionId] = null; // No respondida
    }
  });

  try {
    // Mostrar loading
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Enviando examen...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
    }

    // Enviar respuestas al servidor
    const savedUser = localStorage.getItem("currentUser");
    const user = JSON.parse(savedUser);

    const res = await fetch("http://localhost:3000/api/examen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cuenta: user.cuenta,
        respuestas: answers,
        tiempoRestante: examTimeLeft
      })
    });

    const data = await res.json();

    // Cerrar loading
    if (typeof Swal !== 'undefined') {
      Swal.close();
    }

    if (res.ok) {
      //ACTUALIZAR ESTADO DE APROBACIÓN
      examApproved = data.aprobado;
      localStorage.setItem("examApproved", examApproved.toString());
      
      //
      //VERIFICAR BOTÓN DE IMPRIMIR
      checkPrintButton();

      // Cerrar modal de examen
      const examModal = document.getElementById("exam-modal");
      if (examModal) {
        examModal.style.display = "none";
      }

      // Actualizar botón de examen
      const examBtn = document.getElementById("exam-btn-fullstack");
      if (examBtn) {
        examBtn.textContent = "Examen Realizado";
        examBtn.disabled = true;
      }

      // Mostrar resultados detallados
      let resultadosHTML = `
        <h3>Resultados del Examen</h3>
        <p><strong>Calificación:</strong> ${data.calificacion}%</p>
        <p><strong>Correctas:</strong> ${data.correctas}/${data.total}</p>
        <p><strong>Estado:</strong> ${data.aprobado ? '✅ APROBADO' : '❌ NO APROBADO'}</p>
        <hr>
        <h4>Detalle por pregunta:</h4>
      `;

      data.resultados.forEach((resultado, index) => {
        resultadosHTML += `
          <div class="resultado-pregunta ${resultado.esCorrecta ? 'correcta' : 'incorrecta'}">
            <p><strong>Pregunta ${index + 1}:</strong> ${resultado.pregunta}</p>
            <p><strong>Tu respuesta:</strong> ${resultado.respuestaUsuario || 'No respondida'} ${resultado.esCorrecta ? '✅' : '❌'}</p>
            ${!resultado.esCorrecta ? `<p><strong>Respuesta correcta:</strong> ${resultado.respuestaCorrecta}</p>` : ''}
          </div>
          <hr>
        `;
      });

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: data.aprobado ? '¡Felicidades! 🎉' : 'Resultados del Examen',
          html: resultadosHTML,
          icon: data.aprobado ? 'success' : 'info',
          confirmButtonText: 'Aceptar',
          width: '800px'
        });
      } else {
        alert(data.mensaje);
      }

    } else {
      showAlert("Error", data.message, "error");
    }
  } catch (error) {
    console.error("Error al enviar examen:", error);
    if (typeof Swal !== 'undefined') {
      Swal.close();
    }
    showAlert("Error", "Error al enviar el examen, pero se ha registrado tu intento.", "error");
  }
}

// =====================================
// FUNCIONES DE API BACKEND
// =====================================
async function login(usuario, password) {
  try {
    const res = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password }),
    });

    const data = await res.json();
    return { ok: res.ok, data };
  } catch (error) {
    console.error("Error en login:", error);
    return { ok: false, data: { message: "Error de conexión con el servidor." } };
  }
}

async function logoutBackend(usuario) {
  try {
    await fetch("http://localhost:3000/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario }),
    });
    console.log(`Logout enviado al backend de ${usuario}`);
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
}

async function enviarContactoBackend(nombre, correo, mensaje) {
  try {
    const res = await fetch("http://localhost:3000/api/contacto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email: correo, mensaje }),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error al enviar contacto:", error);
    return { message: "Error al enviar contacto al servidor." };
  }
}

// =====================================
// FUNCIÓN PARA CARGAR SESIÓN GUARDADA
// =====================================
async function loadSession() {
  const savedUser = localStorage.getItem("currentUser");

  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    
    console.log("🔄 Sincronizando con backend...");
    
    try {
      // Obtener estado REAL del backend
      const res = await fetch(`http://localhost:3000/api/usuario/${currentUser.cuenta}`);
      if (res.ok) {
        const userState = await res.json();
        
        // Sincronizar con backend
        paymentStatus = userState.pago;
        examTaken = userState.intento;
        examApproved = userState.aprobado;
        
        // Actualizar localStorage con datos REALES del backend
        localStorage.setItem("paymentStatus", paymentStatus.toString());
        localStorage.setItem("examTaken", examTaken.toString());
        localStorage.setItem("examApproved", examApproved.toString());
        
        console.log("✅ Sincronizado con backend:", userState);
      } else {
        throw new Error('No se pudo obtener estado del backend');
      }
    } catch (error) {
      console.log("⚠️ Error sincronizando, usando estado local");
      // Usar estado local como fallback
      const savedPaymentStatus = localStorage.getItem("paymentStatus");
      const savedExamTaken = localStorage.getItem("examTaken");
      const savedExamApproved = localStorage.getItem("examApproved");
      
      paymentStatus = savedPaymentStatus === "true";
      examTaken = savedExamTaken === "true";
      examApproved = savedExamApproved === "true";
    }

    updateUserInterface();
    checkPrintButton();
    console.log("Sesión cargada para:", currentUser.cuenta);
  }
}

// =====================================
// FUNCIÓN PARA VERIFICAR BOTÓN DE IMPRIMIR
// =====================================
function checkPrintButton() {
  const btnImprimir = document.getElementById("btn-imprimir");
  
  if (btnImprimir) {
    // Mostrar botón solo si: usuario logueado Y examen aprobado
    if (currentUser && examApproved) {
      btnImprimir.style.display = "inline-block";
      console.log("🖨️ Botón de imprimir habilitado - Usuario aprobó el examen");
    } else {
      btnImprimir.style.display = "none";
    }
  }
}

// =====================================
// FUNCIÓN PARA ACTUALIZAR INTERFAZ DE USUARIO
// =====================================
function updateUserInterface() {
  const userDisplay = document.getElementById("user-display");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const payBtn = document.getElementById("pay-btn-fullstack");
  const examBtn = document.getElementById("exam-btn-fullstack");

  if (userDisplay) userDisplay.textContent = currentUser.cuenta;
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-block";

  if (payBtn && paymentStatus) {
    payBtn.textContent = "Pagado";
    payBtn.disabled = true;
    payBtn.classList.remove("btn-primary");
    payBtn.classList.add("btn-disabled");
  }

  if (examBtn) {
    if (paymentStatus && !examTaken) {
      examBtn.disabled = false;
      examBtn.classList.remove("btn-disabled");
      examBtn.classList.add("btn-secondary");
    } else if (examTaken) {
      examBtn.disabled = true;
      examBtn.textContent = "Examen Realizado";
      examBtn.classList.remove("btn-secondary");
      examBtn.classList.add("btn-disabled");
    }
  }
}

// =====================================
// ALERTAS Y CONFIRMACIONES
// =====================================
function showAlert(title, text, icon = "info") {
  if (typeof Swal !== "undefined") {
    return Swal.fire({ title, text, icon, confirmButtonText: "Aceptar" });
  } else alert(`${title}: ${text}`);
}

function showConfirm(title, text, confirmButtonText = "Sí", cancelButtonText = "Cancelar") {
  if (typeof Swal !== "undefined") {
    return Swal.fire({
      title,
      text,
      icon: "question",
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText,
    });
  } else {
    const result = confirm(`${title}: ${text}`);
    return Promise.resolve({ isConfirmed: result });
  }
}
