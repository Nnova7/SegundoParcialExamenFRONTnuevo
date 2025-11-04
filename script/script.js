// =====================================
// VARIABLES GLOBALES
// =====================================
let currentUser = null;
let paymentStatus = false;
let examTaken = false;
let contactMessages = [];
let examTimer = null;
let examTimeLeft = 1200; // 20 min 
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

  // Examen
  const examModal = document.getElementById("exam-modal");
  const examTimerDisplay = document.getElementById("exam-timer");
  const examQuestionsContainer = document.getElementById("exam-questions");
  const submitExamBtn = document.getElementById("submit-exam-btn");
  const closeExamModal = document.querySelector(".close-exam-modal");
  const examUser = document.getElementById("exam-user");
  const examDate = document.getElementById("exam-date");

  // ===============================
  // CARGAR SESIÓN GUARDADA
  // ===============================
  loadSession();
  
  // ===============================
  // BOTÓN EXPLORAR CERTIFICACIONES
  // ===============================
  const explorarBtn = document.getElementById("explorar-btn");

  if (explorarBtn) {
    explorarBtn.addEventListener("click", function () {
      // Redirige a la página de certificaciones
      window.location.href = "certificados.html";
    });
  }

  // ===============================
  // ABRIR / CERRAR MODAL DE LOGIN
  // ===============================
  if (loginBtn && loginModal)
    loginBtn.addEventListener("click", () => (loginModal.style.display = "flex"));
  if (closeModal)
    closeModal.addEventListener("click", () => (loginModal.style.display = "none"));

  // ===============================
  // LOGIN
  // ===============================
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const cuenta = document.getElementById("username").value.trim();
      const contrasena = document.getElementById("password").value.trim();

      if (!cuenta || !contrasena) {
        showAlert("Campos vacíos", "Por favor, ingrese usuario y contraseña.", "warning");
        return;
      }

      try {
        const response = await fetch("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cuenta, contrasena }),
        });

        const data = await response.json();
        console.log("Respuesta completa del backend:", data);

        if (response.ok && data.usuario) {
          //Guardar usuario y token
          currentUser = {
            cuenta: data.usuario.cuenta,
            nombreCompleto: data.usuario.nombre,
            pago: data.usuario.pago || false,
            intento: data.usuario.intento || false,
            aprobado: data.usuario.aprobado || false,
          };

          paymentStatus = currentUser.pago;
          examTaken = currentUser.intento;
          examApproved = currentUser.aprobado;

          localStorage.setItem("currentUser", JSON.stringify(currentUser));
          localStorage.setItem("paymentStatus", paymentStatus.toString());
          localStorage.setItem("examTaken", examTaken.toString());
          localStorage.setItem("examApproved", examApproved.toString());
          
          if (data.token) {
            localStorage.setItem("authToken", data.token);
            console.log("Token guardado correctamente.");
          }

          updateUserInterface();
          if (loginModal) loginModal.style.display = "none";
          showAlert("Acceso permitido", `Bienvenido ${currentUser.nombreCompleto}`, "success");
        } else {
          showAlert("Acceso denegado", data.message || "Usuario o contraseña incorrectos.", "error");
        }
      } catch (error) {
        console.error("❌ Error al conectar con el servidor:", error);
        showAlert("Error de conexión", "No se pudo conectar con el servidor.", "error");
      }

      loginForm.reset();
    });
  }

  // ===============================
  // LOGOUT
  // ===============================
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      if (examTimer) {
        clearInterval(examTimer);
        examTimer = null;
      }

      // Mostrar confirmación
      const confirmacion = await showConfirm(
        "Cerrar Sesión",
        "¿Estás seguro de que deseas cerrar sesión?",
        "Sí, Cerrar",
        "Cancelar"
      );

      if (!confirmacion.isConfirmed) return;

      if (currentUser) {
        try {
          await logoutBackend(currentUser.cuenta);
        } catch (error) {
          console.error("Error al cerrar sesión en el backend:", error);
        }
      }

      //Limpiar datos
      currentUser = null;
      paymentStatus = false;
      examTaken = false;
      examApproved = false;
      examQuestions = [];
      examTimeLeft = 10800;
      
      localStorage.removeItem("currentUser");
      localStorage.removeItem("paymentStatus");
      localStorage.removeItem("examTaken");
      localStorage.removeItem("examApproved");
      localStorage.removeItem("authToken");

      updateUserInterface();
      
      if (examModal) examModal.style.display = "none";
      showAlert("Sesión cerrada", "Has cerrado sesión correctamente", "info");
    });
  }

  // ===============================
  // PAGO
  // ===============================
  if (payBtn) {
    payBtn.addEventListener("click", async function (event) {
      event.preventDefault();

      if (!currentUser) {
        showAlert("Acceso requerido", "Debe iniciar sesión para pagar", "warning");
        return;
      }
      if (paymentStatus) {
        showAlert("Pago ya realizado", "Ya has pagado esta certificación", "info");
        return;
      }

      const confirmacion = await showConfirm(
        "Confirmar pago",
        "¿Deseas pagar $3000 MX por la certificación de JavaScript?",
        "Pagar",
        "Cancelar"
      );

      if (!confirmacion.isConfirmed) return;

      try {
        Swal.fire({ 
          title: "Procesando pago...", 
          allowOutsideClick: false, 
          didOpen: () => Swal.showLoading() 
        });

        const token = localStorage.getItem("authToken");
        if (!token) {
          Swal.close();
          showAlert("Error de autenticación", "Token no encontrado. Por favor, inicie sesión nuevamente.", "error");
          return;
        }

        const res = await fetch("http://localhost:3000/api/pago/confirmar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }
        });

        const data = await res.json();
        Swal.close();

        if (res.ok) {
          paymentStatus = true;
          currentUser.pago = true;
          
          localStorage.setItem("paymentStatus", "true");
          localStorage.setItem("currentUser", JSON.stringify(currentUser));

          updateUserInterface();
          showAlert("Pago exitoso", data.msg || "Pago realizado correctamente.", "success");
        } else {
          showAlert("Error en el pago", data.msg || "No se pudo procesar el pago.", "error");
        }
      } catch (error) {
        Swal.close();
        console.error("Error al procesar el pago:", error);
        showAlert("Error de conexión", "Hubo un problema con el servidor.", "error");
      }
    });
  }

  // ===============================
  // INICIAR EXAMEN
  // ===============================
  if (examBtn) {
    examBtn.addEventListener("click", async function () {
      if (!currentUser) {
        showAlert("Acceso requerido", "Debe iniciar sesión", "warning");
        return;
      }
      if (!paymentStatus) {
        showAlert("Pago requerido", "Debe pagar antes del examen", "warning");
        return;
      }
      if (examTaken) {
        showAlert("Examen ya realizado", "Solo puede hacerlo una vez", "info");
        return;
      }

      const confirmacion = await showConfirm(
        "Iniciar Examen",
        "Duración: 20 minutos. ¿Deseas comenzar?",
        "Comenzar",
        "Cancelar"
      );

      if (confirmacion.isConfirmed) startExam();
    });
  }

  // ===============================
  // FUNCIÓN PARA INICIAR EL EXAMEN
  // ===============================
  async function startExam() {
    try {
      console.log("Iniciando examen desde el servidor...");

      //Token del usuario logueado
      const token = localStorage.getItem("authToken");
      if (!token) {
        showAlert("Sesión expirada", "Debe iniciar sesión nuevamente", "warning");
        return;
      }

      //Solicitar examen al backend
      const res = await fetch("http://localhost:3000/api/examen/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert("Error", data.msg || "No se pudo iniciar el examen", "error");
        return;
      }

      //Guardar las preguntas recibidas
      examQuestions = data.examen || [];
      console.log(`✅ ${examQuestions.length} preguntas cargadas desde el backend`);

      if (examQuestions.length === 0) {
        showAlert("Error", "No se pudieron cargar las preguntas del examen", "error");
        return;
      }

      //Obtener tiempo del examen desde el backend
      try {
        const tiempoRes = await fetch("http://localhost:3000/api/examen/tiempo", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (tiempoRes.ok) {
          const tiempoData = await tiempoRes.json();
          const minutosDesdeBack = tiempoData.minutos || 20;
          examTimeLeft = minutosDesdeBack * 60;
          console.log(`Tiempo del examen: ${minutosDesdeBack} minutos`);
        } else {
          throw new Error("No se pudo obtener el tiempo");
        }
      } catch (error) {
        console.error("No se pudo obtener el tiempo desde el backend, usando valor por defecto (20 min).");
        examTimeLeft = 20 * 60;
      }

      updateExamTimer();

      //Iniciar el temporizador
      if (examTimer) {
        clearInterval(examTimer);
      }
      
      examTimer = setInterval(function () {
        examTimeLeft--;
        updateExamTimer();

        if (examTimeLeft <= 0) {
          clearInterval(examTimer);
          examTimer = null;
          autoSubmitExam();
        }
      }, 1000);

      //Mostrar las preguntas en pantalla
      if (examModal) {
        loadExamQuestions();
        //Mostrar usuario y fecha actual en el examen
        if (examUser && currentUser) {
          examUser.textContent = currentUser.nombreCompleto || currentUser.cuenta || "Invitado";
        }
        if (examDate) {
          const today = new Date();
          const formattedDate = today.toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
          examDate.textContent = formattedDate;
        }
        examModal.style.display = "flex";
      }

      console.log("Examen iniciado para:", currentUser.cuenta);
    } catch (error) {
      console.error("❌ Error al iniciar el examen:", error);
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
          <h3>Pregunta ${index + 1}: ${q.texto || 'Pregunta sin texto'}</h3>
          <div class="options">
            ${(q.opciones || []).map(option => `
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

    //Cambiar color cuando quede poco tiempo
    if (examTimeLeft < 300) { // 5 minutos
      examTimerDisplay.style.color = 'red';
      examTimerDisplay.style.fontWeight = 'bold';
    } else {
      examTimerDisplay.style.color = '';
      examTimerDisplay.style.fontWeight = '';
    }
  }

  // ===============================
  // ENVIAR EXAMEN
  // ===============================
  if (submitExamBtn) {
    submitExamBtn.addEventListener("click", async function() {
      const confirmacion = await showConfirm(
        "Enviar Examen",
        "¿Estás seguro de que deseas enviar el examen?",
        "Sí, Enviar",
        "Cancelar"
      );
      
      if (confirmacion.isConfirmed) {
        await submitExam();
      }
    });
  }

  // ===============================
  // FUNCIÓN PARA ENVIAR EXAMEN 
  // ===============================
  async function submitExam() {
    try {
      //Recopilar respuestas
      const respuestas = [];
      const questionElements = document.querySelectorAll('.question');
      
      questionElements.forEach(questionElement => {
        const questionId = questionElement.dataset.questionId;
        const selectedOption = questionElement.querySelector('input[type="radio"]:checked');
        
        if (selectedOption) {
          respuestas.push({
            preguntaId: questionId,
            respuesta: selectedOption.value
          });
        } else {
          respuestas.push({
            preguntaId: questionId,
            respuesta: "" //Respuesta vacía si no respondió
          });
        }
      });

      console.log("Enviando respuestas:", respuestas);

      //Enviar respuestas al backend
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:3000/api/examen/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          respuestas: respuestas,
          tiempoUtilizado: 10800 - examTimeLeft
        })
      });

      const data = await response.json();

      //Mostrar respuesta completa del backend
      console.log("RESPUESTA COMPLETA DEL BACKEND:", data);
      console.log("PROPIEDADES DISPONIBLES:", Object.keys(data));
      console.log("¿Existe data.aprobado?:", 'aprobado' in data);
      console.log("Valor de data.aprobado:", data.aprobado);

      if (response.ok) {
        //Limpiar temporizador
        if (examTimer) {
          clearInterval(examTimer);
          examTimer = null;
        }

        examApproved = data.aprobado !== undefined ? data.aprobado : false;
        examTaken = true;
        
        localStorage.setItem('examTaken', 'true');
        localStorage.setItem('examApproved', examApproved.toString());

        //Actualizar usuario actual
        if (currentUser) {
          currentUser.intento = true;
          currentUser.aprobado = examApproved;
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }

        //Cerrar modal
        const examModal = document.getElementById('exam-modal');
        if (examModal) examModal.style.display = 'none';

        //Mostrar resultado con información detallada
        console.log("Resultado final del examen:", {
          aprobado: examApproved,
          calificacion: data.calificacion,
          aciertos: data.aciertos,
          total: data.totalPreguntas,
          mensaje: data.mensaje
        });

        showAlert(
          'Examen Finalizado', 
          `Has ${examApproved ? 'APROBADO' : 'REPROBADO'} el examen.\n` +
          `${data.aciertos}/${data.totalPreguntas} aciertos (${data.calificacion}%)\n` +
          `${data.mensaje || ''}`,
          examApproved ? 'success' : 'error'
        );

        //Actualizar interfaz
        updateUserInterface();

        //Si aprobó, mostrar botón de certificado
        if (examApproved) {
          const printBtn = document.getElementById("btn-imprimir");
          if (printBtn) {
            printBtn.style.display = "inline-block";
          }

          localStorage.setItem("certificadoDisponible", "true");
        } else {
          localStorage.setItem("certificadoDisponible", "false");
        }

      } else {
        showAlert('Error', data.msg || 'Error al enviar el examen', 'error');
      }

    } catch (error) {
      console.error('Error al enviar examen:', error);
      showAlert('Error', 'No se pudo enviar el examen. Verifica la conexión.', 'error');
    }
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
        const confirmacion = confirm("¿Estás seguro de que deseas cerrar el examen? El progreso se perderá.");
        if (confirmacion) {
          if (examTimer) {
            clearInterval(examTimer);
            examTimer = null;
          }
          examModal.style.display = "none";
        }
      }
    });
  }

  // ===============================
  // CONTACTO
  // ===============================
  if (contactForm) {
    contactForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      
      const nombre = document.getElementById("name").value.trim();
      const correo = document.getElementById("email").value.trim();
      const mensaje = document.getElementById("message").value.trim();

      if (!nombre || !correo || !mensaje) {
        showAlert("Campos incompletos", "Por favor, complete todos los campos.", "warning");
        return;
      }

      if (!isValidEmail(correo)) {
        showAlert("Email inválido", "Por favor, ingrese un email válido.", "warning");
        return;
      }

      try {
        const response = await enviarContactoBackend(nombre, correo, mensaje);
        showAlert("Mensaje Enviado", response.message, "success");

        contactMessages.push({ nombre, correo, mensaje, fecha: new Date().toISOString() });
        contactForm.reset();
      } catch (error) {
        showAlert("Error", "No se pudo enviar el mensaje. Intente nuevamente.", "error");
      }
    });
  }

  // ===============================
  // CERRAR MODALES AL HACER CLIC FUERA
  // ===============================
  window.addEventListener("click", (e) => {
    if (e.target === loginModal) loginModal.style.display = "none";
    if (examModal && examModal.style.display === "flex" && e.target === examModal) {
      const confirmacion = confirm("¿Estás seguro de que deseas cerrar? El progreso del examen se perderá.");
      if (confirmacion) {
        if (examTimer) {
          clearInterval(examTimer);
          examTimer = null;
        }
        examModal.style.display = "none";
      }
    }
  });


  // ===============================
  // IMPRIMIR CERTIFICADO
  // ===============================
  const btnImprimir = document.getElementById("btn-imprimir");
  if (btnImprimir) {
    btnImprimir.addEventListener("click", function () {
      const certificadoDisponible = localStorage.getItem("certificadoDisponible") === "true";
      const userData = localStorage.getItem('currentUser');
      const currentUser = userData ? JSON.parse(userData) : null;

      // Debug: ver qué hay en localStorage
      console.log('Debug - Token:', localStorage.getItem('authToken'));
      console.log('Debug - User:', currentUser);
      console.log('Debug - Exam Approved:', examApproved);
      console.log('Debug - Certificado Disponible:', certificadoDisponible);

      if (currentUser && (examApproved || certificadoDisponible)) {
        const token = localStorage.getItem("authToken");
        
        if (!token) {
          showAlert("Error", "No hay sesión activa. Por favor inicia sesión nuevamente.", "error");
          //Redirigir al login
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 2000);
          return;
        }

        //MÉTODO 1: Usar XMLHttpRequest (más confiable para headers)
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://localhost:3000/api/certificate/generate', true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.responseType = 'blob';
        
        xhr.onload = function() {
          if (xhr.status === 200) {
            //Éxito - crear y descargar PDF
            const blob = new Blob([xhr.response], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'certificado.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showAlert("Éxito", "Certificado generado correctamente", "success");
          } else if (xhr.status === 401) {
            showAlert("❌ Sesión expirada", "Tu sesión ha expirado. Por favor inicia sesión nuevamente.", "error");
            // Limpiar localStorage y redirigir
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            setTimeout(() => {
              window.location.href = 'login.html';
            }, 2000);
          } else if (xhr.status === 403) {
            showAlert("Acceso denegado", "No estás aprobado para generar certificado", "warning");
          } else {
            showAlert("❌ Error", "No se pudo generar el certificado. Error: " + xhr.status, "error");
          }
        };
        
        xhr.onerror = function() {
          showAlert("❌ Error de conexión", "No se pudo conectar al servidor. Verifica que esté corriendo en el puerto 3000.", "error");
        };
        
        xhr.send();
        
      } else {
        showAlert("Acceso denegado", "Debes aprobar el examen para imprimir el certificado", "warning");
      }
    });
  }
  });

  // ===============================
  // FUNCIÓN: CARGAR SESIÓN
  // ===============================
  async function loadSession() {
    const savedUser = localStorage.getItem("currentUser");
    const savedToken = localStorage.getItem("authToken");
    
    if (savedUser && savedToken) {
      try {
        currentUser = JSON.parse(savedUser);
        paymentStatus = localStorage.getItem("paymentStatus") === "true";
        examTaken = localStorage.getItem("examTaken") === "true";
        examApproved = localStorage.getItem("examApproved") === "true";

        // Verificar token con el backend
        const verifyRes = await fetch("http://localhost:3000/api/auth/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${savedToken}`
          }
        });

        if (verifyRes.ok) {
          // Token válido, sincronizar datos del usuario
          const userRes = await fetch(`http://localhost:3000/api/auth/user`, {
            headers: {
              Authorization: `Bearer ${savedToken}`
            }
          });

          if (userRes.ok) {
            const userData = await userRes.json();
            // Actualizar datos locales con los del servidor
            if (userData.usuario) {
              paymentStatus = userData.usuario.pago || false;
              examTaken = userData.usuario.intento || false;
              examApproved = userData.usuario.aprobado || false;
              
              // Actualizar currentUser
              currentUser.pago = paymentStatus;
              currentUser.intento = examTaken;
              currentUser.aprobado = examApproved;
              
              // Actualizar localStorage
              localStorage.setItem("currentUser", JSON.stringify(currentUser));
              localStorage.setItem("paymentStatus", paymentStatus.toString());
              localStorage.setItem("examTaken", examTaken.toString());
              localStorage.setItem("examApproved", examApproved.toString());
            }
          }
        } else {
          // Token inválido, limpiar sesión
          console.warn("Token inválido, limpiando sesión");
          paymentStatus = false;
          examTaken = false;
          examApproved = false;
        }
      } catch (error) {
        console.warn("⚠️ Error verificando sesión, usando datos locales:", error);
        // En caso de error, usar datos locales
        currentUser = JSON.parse(savedUser);
        paymentStatus = localStorage.getItem("paymentStatus") === "true";
        examTaken = localStorage.getItem("examTaken") === "true";
        examApproved = localStorage.getItem("examApproved") === "true";
      }

      updateUserInterface();

      //Refresca el header siempre, incluso tras recargar o cambiar página
      const userDisplay = document.getElementById("user-display");
      if (userDisplay && currentUser) {
        userDisplay.textContent = currentUser.cuenta || currentUser.nombreCompleto || "Usuario";
      }
      console.log("Sesión cargada para:", currentUser?.nombreCompleto);
    }else {
      //Si no hay sesión activa
      const userDisplay = document.getElementById("user-display");
      if (userDisplay) userDisplay.textContent = "Invitado";
    }
  }

  // ===============================
  // ACTUALIZAR INTERFAZ DE USUARIO
  // ===============================
  function updateUserInterface() {
  const userDisplay = document.getElementById("user-display");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const payBtn = document.getElementById("pay-btn-fullstack");
  const examBtn = document.getElementById("exam-btn-fullstack");
  const printBtn = document.getElementById("btn-imprimir");

  // Leer usuario actual desde localStorage si no está en memoria
  if (!currentUser) {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) currentUser = JSON.parse(storedUser);
  }
  
  if (currentUser) {
    if (userDisplay) userDisplay.textContent = `👤 ${currentUser.cuenta || currentUser.nombreCompleto || "Usuario"}`;
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";

    // Actualizar botón de pago
    if (payBtn) {
      if (paymentStatus) {
        payBtn.textContent = "Pagado";
        payBtn.disabled = true;
        payBtn.classList.remove("btn-primary");
        payBtn.classList.add("btn-disabled");
      } else {
        payBtn.textContent = "Pagar $3000 MX";
        payBtn.disabled = false;
        payBtn.classList.remove("btn-disabled");
        payBtn.classList.add("btn-primary");
      }
    }

    //Actualizar botón de examen
    if (examBtn) {
      if (examTaken) {
        examBtn.textContent = "Examen Realizado";
        examBtn.disabled = true;
        examBtn.classList.remove("btn-secondary");
        examBtn.classList.add("btn-disabled");
      } else if (paymentStatus) {
        examBtn.textContent = "Iniciar Examen";
        examBtn.disabled = false;
        examBtn.classList.remove("btn-disabled");
        examBtn.classList.add("btn-secondary");
      } else {
        examBtn.textContent = "Iniciar Examen";
        examBtn.disabled = true;
        examBtn.classList.remove("btn-secondary");
        examBtn.classList.add("btn-disabled");
      }
    }

    //Actualizar botón de imprimir
    if (printBtn) {
      printBtn.style.display = examApproved ? "inline-block" : "none";
    }

    //Verificar si el certificado está disponible en localStorage
    const certificadoDisponible = localStorage.getItem("certificadoDisponible") === "true";
    if (printBtn) {
      printBtn.style.display = (examApproved || certificadoDisponible) ? "inline-block" : "none";
    }
  } else {
    //Usuario no logueado
    if (userDisplay) userDisplay.textContent = "Invitado";
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    
    if (payBtn) {
      payBtn.textContent = "Pagar $3000 MX";
      payBtn.disabled = false;
    }
    
    if (examBtn) {
      examBtn.textContent = "Iniciar Examen";
      examBtn.disabled = true;
    }
    
    if (printBtn) printBtn.style.display = "none";
  }
}

// ===============================
// MOSTRAR USUARIO ACTIVO EN HEADER EN TODAS LAS PÁGINAS
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("currentUser");
  const userDisplay = document.getElementById("user-display");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  if (savedUser) {
    const user = JSON.parse(savedUser);
    if (userDisplay) userDisplay.textContent = user.cuenta || user.nombreCompleto;
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
  } else {
    if (userDisplay) userDisplay.textContent = "Invitado";
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
});

// ===============================
// FUNCIONES AUXILIARES
// ===============================
function showAlert(title, text, icon = "info") {
  if (typeof Swal !== "undefined") {
    return Swal.fire({ 
      title, 
      text, 
      icon,
      confirmButtonText: 'Aceptar'
    });
  }
  alert(`${title}: ${text}`);
}

async function showConfirm(title, text, confirmText = "Sí", cancelText = "Cancelar") {
  if (typeof Swal !== "undefined") {
    return await Swal.fire({ 
      title, 
      text, 
      icon: "question", 
      showCancelButton: true, 
      confirmButtonText: confirmText, 
      cancelButtonText: cancelText 
    });
  }
  
  const result = confirm(`${title}: ${text}`);
  return { isConfirmed: result };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ===============================
// API BACKEND
// ===============================
async function logoutBackend(usuario) {
  try {
    const token = localStorage.getItem("authToken");
    await fetch("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ usuario }),
    });
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
}

async function enviarContactoBackend(nombre, correo, mensaje) {
  try {
    const res = await fetch("http://localhost:3000/api/contacto/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email: correo, mensaje }),
    });
    
    if (!res.ok) {
      throw new Error(`Error ${res.status}: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error("Error al enviar contacto:", error);
    throw error;
  }
}