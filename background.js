var i = 0;
var url = 'https://www.paypal.me/typicalness';
var home = 'https://www.google.com';
var web = ["webview1", "webview2", "webview3", "webview4", "webview5"];
const PERSISTENT_PARTITION = 'persist:globalstorage';

// Load home from storage if saved
chrome.storage.sync.get('home', (data) => {
  if (data.home) home = data.home;
});

// Creates a new app window
function createWindow(param, isPopup = false) {
  i = (i + 1) % web.length;

  const windowOptions = {
    id: web[i],
    frame: 'chrome',
    innerBounds: { width: 1024, height: 768 },
    resizable: true, // 👈 debe ser true

  };

  if (isPopup) {
    Object.assign(windowOptions, {
      type: 'panel',
      frame: 'none',
      innerBounds: {
        width: 500,
        height: 600,
        minWidth: 400,
        minHeight: 400
      }
    });
  }

  chrome.app.window.create('window.html', windowOptions, (appwindow) => {
    appwindow.contentWindow.onload = function () {
      const doc = appwindow.contentWindow.document;
      const browser = doc.getElementById('browser');
      const webBar = doc.getElementById('webBar');

      //browser.setAttribute('partition', PERSISTENT_PARTITION);
      //browser.setAttribute('allowpopups', 'on');
      //browser.setAttribute('webpreferences', 'nativeWindowOpen=yes, sandbox=no');

      // Detect popups
     browser.addEventListener('enter-html-full-screen', () => {
       appwindow.fullscreen();
       console.log("helpme")
      
     });
     
     browser.addEventListener('leave-html-full-screen', () => {
       appwindow.restore();
     });
      browser.addEventListener('newwindow', (e) => {
        e.preventDefault();
        const popupUrl = e.targetUrl || e.initialTargetUrl;
          if (/^https:\/\/accounts\.google\.com\//.test(popupUrl)) {
            // En vez de abrir la URL original de Google, abres tu página de login que redirige a Google
            const loginWindow = window.open("https://flamaelectro.github.io/inicio-test/index.html"); // tu página login.html en GitHub Pages
          
            // Escuchar mensaje solo una vez, para no acumular listeners si abres varias ventanas
            function onMessage(event) {
              // Opcional: validar event.origin si quieres seguridad extra
              if (event.data && event.data.type === "access_token") {
                const token = event.data.token;
                console.log("✅ Token recibido desde callback:", token);
          
                // Aquí usas el token como necesites (enviar al juego, autenticar, etc.)
          
                // Ya no necesitas escuchar más mensajes, quita el listener
                window.removeEventListener("message", onMessage);
          
                // Cerrar ventana login si sigue abierta
                if (loginWindow && !loginWindow.closed) loginWindow.close();
              }
            }
          
            window.addEventListener("message", onMessage);
          }else{
          // Lógica normal para otros popups
            monitorLoginPopup(popupUrl);
            
          }
       
        
        
        
      });

      // Update webBar when page loads
      browser.addEventListener('contentload', () => {
        webBar.value = browser.src;
      });

      // UI buttons
      doc.getElementById('backButton').onclick = () => browser.back();
      doc.getElementById('forwardButton').onclick = () => browser.forward();
      doc.getElementById('refreshButton').onclick = () => browser.reload();
      doc.getElementById('homeButton').onclick = () => browser.src = home;

      doc.getElementById('newWindow').onclick = () => {
        createWindow({ launch: 'empty' });
      };

      doc.getElementById('donate').onclick = () => {
        createWindow({ launch: url }, true);
      };

      // Set homepage
      doc.getElementById('setHome').onkeypress = (e) => {
        if (e.key === 'Enter') {
          home = e.target.value;
          chrome.storage.sync.set({ home });
          browser.src = home;
        }
      };

      // Omnibox logic
      webBar.onkeypress = (e) => {
        if (e.key === 'Enter') {
          let input = e.target.value;
          if (!/^https?:\/\//.test(input)) {
            if (input.includes('.') && !input.includes(' ')) {
              input = 'https://' + input;
            } else {
              input = 'https://www.google.com/search?q=' + encodeURIComponent(input);
            }
          }
          browser.src = input;
        }
      };

      webBar.onfocus = () => {
        if (webBar.value === browser.src) webBar.select();
      };

      // Load page
      const targetUrl = param.launch && param.launch !== 'empty' ? param.launch : home;
      browser.src = targetUrl;
    };
  });
}

// ✅ Manual token capture from login window
function monitorLoginPopup(url) {
  chrome.app.window.create('window.html', {
    id: 'loginPopup_' + Date.now(),
    innerBounds: { width: 500, height: 600 }
  }, (popup) => {
    popup.contentWindow.onload = () => {
      const popupDoc = popup.contentWindow.document;
      const webview = popupDoc.getElementById('browser');
      if (!webview) return;

      webview.setAttribute('partition', PERSISTENT_PARTITION);
      webview.setAttribute('allowpopups', 'on');
      webview.setAttribute('webpreferences', 'nativeWindowOpen=yes, sandbox=no');
      webview.setAttribute('src', url);

      // Poll for token in URL every 500ms
      const interval = setInterval(() => {
        try {
          const currentUrl = webview.getAttribute('src');
          if (currentUrl && currentUrl.includes('access_token=')) {
            const tokenMatch = currentUrl.match(/access_token=([^&]+)/);
            if (tokenMatch) {
              const token = tokenMatch[1];
              console.log('%c[✅ TOKEN GRABBED]', 'color: limegreen', token);
              clearInterval(interval);
              popup.close();

              // ✅ Do something with the token (optional)
              chrome.storage.local.set({ googleAccessToken: token });
            }
          }
        } catch (e) {
          // silently ignore sandbox errors
        }
      }, 500);
    };
  });
}

// Launch app
chrome.app.runtime.onLaunched.addListener(() => {
  createWindow({ launch: 'empty' });
});
