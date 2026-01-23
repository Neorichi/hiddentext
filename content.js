(async function () {

    // Function to get the key from the 'private_key' file
    async function getKey() {
      try {
        // Verificar si el contexto de la extensión sigue válido
        if (!chrome?.runtime?.id) {
          return "";
        }
        const url = chrome.runtime.getURL("private_key");
        const response = await fetch(url);
        if (!response.ok) {
          return "";
        }
        const text = await response.text();
        return text.trim();
      } catch (err) {
        // Silenciar errores comunes
        if (err.message?.includes('Extension context invalidated') ||
            err.message?.includes('Failed to fetch')) {
          return "";
        }
        console.error("Error al leer private_key:", err);
        return "";
      }
    }


    function encryptText(text, key) {
        return CryptoJS.AES.encrypt(text, key).toString();
    }

    function decryptText(encrypted, key) {
        const bytes = CryptoJS.AES.decrypt(encrypted, key);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    const isWhatsApp = location.hostname.includes("whatsapp");
    const isTelegram = location.hostname.includes("web.telegram");

    const ZERO = '\u2060';
    const ONE = '\u2063';

    // Función para obtener el nombre del chat actual
    function getCurrentChatName() {
        try {
            if (isWhatsApp) {
                // WhatsApp: el nombre está en el header, buscar el span con el título del contacto
                const conversationHeader = document.querySelector('#main header');
                if (conversationHeader) {
                    // Buscar el primer span con título dentro del header
                    const titleSpan = conversationHeader.querySelector('span[title]');
                    if (titleSpan && titleSpan.title) {
                        return titleSpan.title;
                    }
                    // Alternativa: buscar el div con el nombre
                    const nameDiv = conversationHeader.querySelector('div[title]');
                    if (nameDiv && nameDiv.title) {
                        return nameDiv.title;
                    }
                }
                return 'Unknown';
            } else if (isTelegram) {
                // Telegram: nombre en el header del chat
                const peerTitle = document.querySelector('.chat-info .peer-title') ||
                                  document.querySelector('.top .peer-title') ||
                                  document.querySelector('[class*="ChatInfo"] [class*="title"]');
                return peerTitle?.textContent?.trim() || 'Unknown';
            }
            return 'Unknown';
        } catch (e) {
            console.warn('Error obteniendo nombre del chat:', e);
            return 'Unknown';
        }
    }

    // Función para generar timestamp
    function getTimestamp() {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        if (isWhatsApp) {
            // Formato corto para WhatsApp: DDMMYYYY
            return `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
        }
        // Formato completo para Telegram
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    // Función para crear el payload con marca de agua
    function createWatermarkedPayload(secret) {
        if (isWhatsApp) {
            // Solo el mensaje secreto en WhatsApp
            return secret;
        }
        // Formato completo para Telegram
        const chatName = getCurrentChatName();
        const timestamp = getTimestamp();
        return `[${timestamp}] To: ${chatName} | ${secret}`;
    }

    function textToInvisibles(secret) {
        return [...secret]
            .map(c => c.charCodeAt(0).toString(2).padStart(8, '0'))
            .join('')
            .split('')
            .map(b => b === '0' ? ZERO : ONE)
            .join('');
    }

    function invisiblesToText(chars) {
        const binary = chars.map(c => c === ZERO ? '0' : '1').join('');
        let message = '';
        for (let i = 0; i < binary.length; i += 8) {
            const byte = binary.slice(i, i + 8);
            if (byte.length === 8) {
                message += String.fromCharCode(parseInt(byte, 2));
            }
        }
        return message;
    }

    // Función para expandir mensajes truncados en WhatsApp
    function expandTruncatedMessages() {
        if (!isWhatsApp) return;

        // Buscar botones "Read more" / "Leer más" y hacer clic
        const readMoreButtons = document.querySelectorAll('.read-more, [data-testid="expand-button"], span[role="button"]');
        readMoreButtons.forEach(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            if (text.includes('read more') || text.includes('leer más') || text.includes('ver más')) {
                if (!btn.classList.contains('auto-expanded')) {
                    btn.classList.add('auto-expanded');
                    btn.click();
                }
            }
        });

        // También buscar el contenedor de mensajes truncados y expandirlos
        const truncatedMessages = document.querySelectorAll('._ao3e [role="button"], .message-in [role="button"], .message-out [role="button"]');
        truncatedMessages.forEach(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            if ((text.includes('read more') || text.includes('leer más') || text.includes('ver más')) && !btn.classList.contains('auto-expanded')) {
                btn.classList.add('auto-expanded');
                btn.click();
            }
        });
    }

    async function showSecretsInMessages() {
        try {
          const show = localStorage.getItem("show-secrets") !== "false";
          const key = await getKey();
          if (!show) {
            document.querySelectorAll(".inserted-secret").forEach((el) => el.remove());
            document.querySelectorAll(".checked-secret").forEach((m) => m.classList.remove("checked-secret"));
            return;
          }

          // Expandir mensajes truncados antes de buscar secretos
          if (isWhatsApp) {
            expandTruncatedMessages();
          }

          let messages = [];
          if (isWhatsApp) {
            // WhatsApp: seleccionar solo el contenedor del mensaje, no elementos padre
            messages = document.querySelectorAll('.message-in .copyable-text, .message-out .copyable-text');
          } else if (isTelegram) {
            // Telegram: buscar el contenedor de texto del mensaje
            // Para mensajes reenviados, buscar dentro de .content-inner .text-content
            messages = Array.from(document.querySelectorAll('.text-content.clearfix, .message-content:not(.is-forwarded) > .text-content'))
              .filter(m =>
                !m.isContentEditable &&
                !m.closest('[contenteditable="true"]') &&
                !m.classList.contains('input-message-input')
              );
          } else {
            messages = document.querySelectorAll('.copyable-text, .text-content');
          }

          messages.forEach((m) => {
            try {
              // Evitar duplicados: verificar si ya se procesó este mensaje
              if (m.classList.contains("checked-secret")) return;
              if (m.querySelector(".inserted-secret")) return;

              // Evitar procesar si un padre ya tiene el secreto insertado
              if (m.closest('.checked-secret')) return;

              const text = m.innerText || "";
              if (!text) {
                m.classList.add("checked-secret");
                return;
              }

              const chars = [...text];
              const invisibles = [];

              // Buscar caracteres invisibles en TODO el texto, no solo al inicio
              // Primero intentar encontrar una secuencia continua al inicio
              let foundAtStart = false;
              for (let i = 0; i < chars.length; i++) {
                if (chars[i] === ZERO || chars[i] === ONE) {
                  invisibles.push(chars[i]);
                  foundAtStart = true;
                } else if (foundAtStart) {
                  // Ya encontramos una secuencia al inicio, paramos
                  break;
                }
              }

              // Si no encontramos al inicio, buscar en todo el texto
              if (invisibles.length === 0) {
                let tempInvisibles = [];
                let inSequence = false;
                for (let i = 0; i < chars.length; i++) {
                  if (chars[i] === ZERO || chars[i] === ONE) {
                    tempInvisibles.push(chars[i]);
                    inSequence = true;
                  } else if (inSequence && tempInvisibles.length >= 8) {
                    // Encontramos una secuencia válida (al menos 1 byte = 8 bits)
                    break;
                  } else if (inSequence) {
                    // Secuencia muy corta, reiniciar
                    tempInvisibles = [];
                    inSequence = false;
                  }
                }
                if (tempInvisibles.length >= 8) {
                  invisibles.push(...tempInvisibles);
                }
              }

              if (invisibles.length > 0) {
                const encrypted = invisiblesToText(invisibles);
                const secret = decryptText(encrypted, key);

                // Solo mostrar si el secreto tiene contenido válido
                if (secret && secret.length > 0) {
                  const tag = document.createElement("div");
                  tag.className = "inserted-secret";
                  tag.textContent = secret;

                  Object.assign(tag.style, {
                    color: "#ffffff",
                    fontSize: "12px",
                    padding: "4px 8px",
                    marginBottom: "6px",
                    background: "rgba(0, 0, 0, 0.5)",
                    borderLeft: "3px solid #6c7ae0",
                    borderRadius: "4px",
                    wordBreak: "break-word",
                    maxWidth: "fit-content"
                  });

                  // Asegurar que no afecte al resto del contenido
                  tag.style.setProperty('color', '#ffffff', 'important');

                  m.insertBefore(tag, m.firstChild);
                }
              }

              m.classList.add("checked-secret");
            } catch (inner) {
              console.warn("Error procesando un mensaje:", inner);
            }
          });
        } catch (e) {
          console.error("showSecretsInMessages() falló:", e);
        }
      }

    // Panel principal - diseño minimalista y serio
    const panel = document.createElement("div");
    panel.id = "secret-panel";

    // Cargar posición guardada o usar default
    const savedPosition = JSON.parse(localStorage.getItem("panel-position") || "null");

    Object.assign(panel.style, {
        position: "fixed",
        background: "#1a1a2e",
        color: "#e0e0e0",
        padding: "16px",
        borderRadius: "6px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        zIndex: "999999",
        fontSize: "13px",
        width: "240px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        border: "1px solid #2a2a4a",
        cursor: "default"
    });

    // Aplicar posición guardada o default
    if (savedPosition) {
        panel.style.left = savedPosition.left + "px";
        panel.style.top = savedPosition.top + "px";
    } else {
        panel.style.bottom = "20px";
        panel.style.right = "20px";
    }

    // Header (arrastradle)
    const header = document.createElement("div");
    Object.assign(header.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "14px",
        paddingBottom: "10px",
        borderBottom: "1px solid #2a2a4a",
        cursor: "move"
    });

    // Funcionalidad de arrastrar
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    header.addEventListener("mousedown", (e) => {
        if (e.target === minimizeBtn) return;
        isDragging = true;
        dragOffsetX = e.clientX - panel.getBoundingClientRect().left;
        dragOffsetY = e.clientY - panel.getBoundingClientRect().top;
        header.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        let newX = e.clientX - dragOffsetX;
        let newY = e.clientY - dragOffsetY;

        // Limitar a los bordes de la ventana
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        // Quitar bottom/right y usar top/left
        panel.style.bottom = "auto";
        panel.style.right = "auto";
        panel.style.left = newX + "px";
        panel.style.top = newY + "px";
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = "move";

            // Guardar posición
            const rect = panel.getBoundingClientRect();
            localStorage.setItem("panel-position", JSON.stringify({
                left: rect.left,
                top: rect.top
            }));
        }
    });

    const title = document.createElement("span");
    title.textContent = "Secure Channel";
    Object.assign(title.style, {
        fontWeight: "600",
        fontSize: "13px",
        color: "#fff",
        letterSpacing: "0.3px"
    });

    const minimizeBtn = document.createElement("button");
    minimizeBtn.textContent = "−";
    Object.assign(minimizeBtn.style, {
        background: "transparent",
        border: "none",
        color: "#888",
        fontSize: "18px",
        cursor: "pointer",
        padding: "0",
        lineHeight: "1"
    });

    header.appendChild(title);
    header.appendChild(minimizeBtn);

    // Content container
    const content = document.createElement("div");

    // Label
    const label = document.createElement("div");
    label.textContent = "PAYLOAD";
    Object.assign(label.style, {
        fontSize: "10px",
        fontWeight: "600",
        color: "#6c7ae0",
        letterSpacing: "1px",
        marginBottom: "6px"
    });

    // Input
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Enter hidden message...";
    Object.assign(input.style, {
        width: "100%",
        padding: "10px",
        background: "#252542",
        border: "1px solid #3a3a5a",
        borderRadius: "4px",
        color: "#fff",
        fontSize: "13px",
        marginBottom: "12px",
        boxSizing: "border-box",
        outline: "none"
    });

    // Checkbox container helper
    function createCheckboxRow(labelText) {
        const row = document.createElement("div");
        Object.assign(row.style, {
            display: "flex",
            alignItems: "center",
            padding: "8px 10px",
            background: "#252542",
            borderRadius: "4px",
            marginBottom: "8px",
            cursor: "pointer"
        });

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        Object.assign(checkbox.style, {
            width: "14px",
            height: "14px",
            accentColor: "#6c7ae0",
            cursor: "pointer"
        });

        const text = document.createElement("span");
        text.textContent = labelText;
        Object.assign(text.style, {
            fontSize: "12px",
            color: "#ccc",
            marginLeft: "10px"
        });

        row.appendChild(checkbox);
        row.appendChild(text);

        row.addEventListener("click", (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event("change"));
            }
        });

        return { row, checkbox };
    }

    const autoInsert = createCheckboxRow("Auto-inject on send");
    const showSecrets = createCheckboxRow("Reveal hidden data");

    // Status
    const status = document.createElement("div");
    Object.assign(status.style, {
        display: "flex",
        alignItems: "center",
        marginTop: "8px",
        paddingTop: "10px",
        borderTop: "1px solid #2a2a4a"
    });

    // Añadir animación de pulso
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes pulse-dot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
    `;
    document.head.appendChild(styleSheet);

    const dot = document.createElement("span");
    Object.assign(dot.style, {
        width: "6px",
        height: "6px",
        background: "#4ade80",
        borderRadius: "50%",
        marginRight: "8px",
        animation: "pulse-dot 2s ease-in-out infinite"
    });

    const statusText = document.createElement("span");
    statusText.textContent = "Channel active";
    Object.assign(statusText.style, {
        fontSize: "10px",
        color: "#666",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
    });

    status.appendChild(dot);
    status.appendChild(statusText);

    // Assemble
    content.appendChild(label);
    content.appendChild(input);
    content.appendChild(autoInsert.row);
    content.appendChild(showSecrets.row);
    content.appendChild(status);

    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);

    // Minimize functionality - cargar estado guardado
    let minimized = localStorage.getItem("panel-minimized") === "true";
    content.style.display = minimized ? "none" : "block";
    minimizeBtn.textContent = minimized ? "+" : "−";

    minimizeBtn.onclick = () => {
        minimized = !minimized;
        content.style.display = minimized ? "none" : "block";
        minimizeBtn.textContent = minimized ? "+" : "−";
        localStorage.setItem("panel-minimized", minimized);
    };

    // Load saved values
    input.value = localStorage.getItem("fixed-secret") || "";
    autoInsert.checkbox.checked = localStorage.getItem("auto-secret") === "true";
    showSecrets.checkbox.checked = localStorage.getItem("show-secrets") !== "false";

    // Event handlers
    input.oninput = () => localStorage.setItem("fixed-secret", input.value);
    autoInsert.checkbox.onchange = () => localStorage.setItem("auto-secret", autoInsert.checkbox.checked);
    showSecrets.checkbox.onchange = () => {
        localStorage.setItem("show-secrets", showSecrets.checkbox.checked);
        showSecretsInMessages();
    };

    // Platform-specific logic
    if (isWhatsApp) {
        window.addEventListener("keydown", async function (event) {
            if (event.key === "Enter" && !event.shiftKey && autoInsert.checkbox.checked) {
                const inputEl = document.querySelector('div[contenteditable="true"][data-tab="10"]');
                if (!inputEl) return;

                const text = inputEl.innerText.trim();
                const secret = input.value.trim();
                if (!secret || text.startsWith(ZERO) || text.startsWith(ONE)) return;

                event.preventDefault();
                event.stopPropagation();

                const key = await getKey();
                const watermarkedSecret = createWatermarkedPayload(secret);
                const hidden = textToInvisibles(encryptText(watermarkedSecret, key));

                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(inputEl);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                document.execCommand("insertText", false, hidden);

                range.selectNodeContents(inputEl);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);

                setTimeout(() => {
                    const enterAgain = new KeyboardEvent("keydown", {
                        key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true
                    });
                    inputEl.dispatchEvent(enterAgain);
                }, 100);
            }
        }, true);

        const observer = new MutationObserver(() => {
            expandTruncatedMessages();
            showSecretsInMessages();
        });
        const startObserver = () => {
            const container = document.querySelector('#app');
            if (container) {
                observer.observe(container, { childList: true, subtree: true });
                // Expandir mensajes truncados periódicamente para mensajes ya cargados
                setInterval(expandTruncatedMessages, 2000);
                expandTruncatedMessages();
                showSecretsInMessages();
            } else {
                setTimeout(startObserver, 1000);
            }
        };
        startObserver();

    } else if (isTelegram) {
        let lastProcessedText = "";

        const inputObserver = new MutationObserver(async () => {
            if (!autoInsert.checkbox.checked) return;
            const inputEl = document.querySelector('[contenteditable="true"]');
            if (!inputEl) return;

            const text = inputEl.innerText.trim();
            if (!text || text === lastProcessedText) return;

            const secret = input.value;
            if (!secret || text.startsWith(ZERO) || text.startsWith(ONE)) return;

            lastProcessedText = text;

            const key = await getKey();
            const watermarkedSecret = createWatermarkedPayload(secret);
            const encrypted = encryptText(watermarkedSecret, key);
            const hidden = textToInvisibles(encrypted);

            const textNode = document.createTextNode(hidden);
            inputEl.insertBefore(textNode, inputEl.firstChild);

            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(inputEl);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        });

        const waitForInput = setInterval(() => {
            const inputEl = document.querySelector('[contenteditable="true"]');
            if (inputEl) {
                inputObserver.observe(inputEl, { childList: true, subtree: true, characterData: true });
                clearInterval(waitForInput);
            }
        }, 500);

        const observer = new MutationObserver(showSecretsInMessages);
        observer.observe(document.body, { childList: true, subtree: true });
        showSecretsInMessages();
    }

})();
