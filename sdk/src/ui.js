const CSS_STYLES = `
  :host {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    z-index: 2147483647; /* Máximo z-index posible */
  }
  
  .floating-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    border-radius: 30px;
    background-color: #4f46e5;
    color: white;
    border: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    transition: transform 0.2s;
  }
  
  .floating-btn:hover {
    transform: scale(1.05);
  }

  .floating-btn.active {
    background-color: #ef4444;
  }

  /* El overlay invisible que capta los clics en toda la pantalla */
  .click-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    cursor: crosshair;
    z-index: 2147483646;
    display: none;
  }

  .click-overlay.active {
    display: block;
  }

  .form-popup {
    position: fixed;
    background: white;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    width: 300px;
    z-index: 2147483647;
    display: none;
  }

  .form-popup.visible {
    display: block;
  }

  .form-popup textarea {
    width: 100%;
    height: 80px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 12px;
    resize: none;
    font-family: inherit;
  }

  .form-popup textarea:focus {
    outline: none;
    border-color: #4f46e5;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn {
    padding: 6px 12px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-cancel {
    background: transparent;
    color: #64748b;
  }

  .btn-cancel:hover {
    background: #f1f5f9;
  }

  .btn-submit {
    background: #4f46e5;
    color: white;
  }

  .btn-submit:hover {
    background: #4338ca;
  }

  .btn-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .pin-marker {
    position: fixed;
    width: 24px;
    height: 24px;
    background: #ef4444;
    border: 2px solid white;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
`;

export class FeedbackUI {
  constructor(onSubmit) {
    this.onSubmit = onSubmit;
    this.isActive = false;
    this.clickPosition = null;

    this.init();
  }

  init() {
    this.host = document.createElement('div');
    this.host.id = 'imgc-feedback-root';
    document.body.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS_STYLES;
    this.shadow.appendChild(style);

    this.renderElements();
    this.attachEvents();
  }

  renderElements() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'click-overlay';

    this.floatingBtn = document.createElement('button');
    this.floatingBtn.className = 'floating-btn';
    this.floatingBtn.innerHTML = '💬';
    this.floatingBtn.title = 'Dejar feedback';

    this.dynamicContainer = document.createElement('div');

    this.shadow.appendChild(this.overlay);
    this.shadow.appendChild(this.dynamicContainer);
    this.shadow.appendChild(this.floatingBtn);
  }

  attachEvents() {
    this.floatingBtn.addEventListener('click', () => this.toggleActiveMode());
    this.overlay.addEventListener('click', (e) => this.handleScreenClick(e));
  }

  toggleActiveMode() {
    this.isActive = !this.isActive;
    this.floatingBtn.classList.toggle('active', this.isActive);
    this.floatingBtn.innerHTML = this.isActive ? '✖' : '💬';
    this.overlay.classList.toggle('active', this.isActive);

    if (!this.isActive) {
      this.closeForm();
    }
  }

  handleScreenClick(e) {
    if (!this.isActive) return;

    const xPercent = (e.clientX / window.innerWidth) * 100;
    const yPercent = (e.clientY / window.innerHeight) * 100;

    this.clickPosition = { x: e.clientX, y: e.clientY, xPercent, yPercent };

    this.showForm(e.clientX, e.clientY);
  }

  showForm(x, y) {
    this.dynamicContainer.innerHTML = ''; 

    const marker = document.createElement('div');
    marker.className = 'pin-marker';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;

    const formPopup = document.createElement('div');
    formPopup.className = 'form-popup visible';
    
    let left = x + 15;
    let top = y + 15;
    
    if (left + 300 > window.innerWidth) left = x - 315;
    if (top + 150 > window.innerHeight) top = y - 165;

    formPopup.style.left = `${left}px`;
    formPopup.style.top = `${top}px`;

    formPopup.innerHTML = `
      <textarea id="fb-comment" placeholder="Describe el problema o comentario..."></textarea>
      <div style="margin-bottom: 12px; font-size: 12px;">
        <label for="fb-files" style="display:block; margin-bottom: 4px; color: #475569;">Adjuntar archivos (opcional)</label>
        <input type="file" id="fb-files" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" style="max-width: 100%;" />
      </div>
      <div class="form-actions">
        <button id="fb-cancel" class="btn btn-cancel">Cancelar</button>
        <button id="fb-submit" class="btn btn-submit">Enviar</button>
      </div>
    `;

    this.dynamicContainer.appendChild(marker);
    this.dynamicContainer.appendChild(formPopup);

    const cancelBtn = formPopup.querySelector('#fb-cancel');
    const submitBtn = formPopup.querySelector('#fb-submit');
    const textarea = formPopup.querySelector('#fb-comment');
    const fileInput = formPopup.querySelector('#fb-files');

    textarea.focus();

    cancelBtn.addEventListener('click', () => this.closeForm());
    submitBtn.addEventListener('click', () => {
      const content = textarea.value.trim();
      if (!content) return;

      const files = Array.from(fileInput.files);

      submitBtn.disabled = true;
      submitBtn.innerText = 'Enviando...';

      this.onSubmit({
        content,
        position: this.clickPosition,
        files
      }).then(() => {
        this.closeForm();
        this.toggleActiveMode(); 
        alert('¡Feedback enviado correctamente!'); 
      }).catch(err => {
        console.error(err);
        alert('Error al enviar el feedback');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Enviar';
      });
    });
  }

  closeForm() {
    this.dynamicContainer.innerHTML = '';
    this.clickPosition = null;
  }
}
