/**
 * DompetKu - Utility Functions
 * Global helper functions for formatting, dates, and UI utilities
 */

const Utils = {
  /**
   * Format number as Indonesian Rupiah currency
   * @param {number} amount - The amount to format
   * @returns {string} Formatted currency string (e.g., "Rp1.500.000")
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  },

  /**
   * Format number with dots as thousand separator (without Rp prefix)
   * @param {number} num - The number to format
   * @returns {string} Formatted number string (e.g., "1.500.000")
   */
  formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num);
  },

  /**
   * Parse formatted number string back to a plain number
   * Strips all non-digit characters and returns integer
   * @param {string} str - The formatted string to parse
   * @returns {number} Parsed integer value, or 0 if invalid
   */
  parseNumber(str) {
    if (!str) return 0;
    return parseInt(str.replace(/\D/g, ''), 10) || 0;
  },

  /**
   * Format date to full Indonesian locale string
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date (e.g., "26 Mei 2026")
   */
  formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  },

  /**
   * Format date to short Indonesian locale string
   * @param {string|Date} date - Date to format
   * @returns {string} Short formatted date (e.g., "26 Mei")
   */
  formatDateShort(date) {
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  },

  /**
   * Get relative date label in Indonesian
   * Returns "Hari Ini", "Kemarin", "X hari lalu", or the full date
   * @param {string} dateStr - ISO date string
   * @returns {string} Relative date label
   */
  getRelativeDateLabel(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const diff = Math.floor((today - date) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hari Ini';
    if (diff === 1) return 'Kemarin';
    if (diff < 7) return `${diff} hari lalu`;
    return Utils.formatDate(date);
  },

  /**
   * Get current month in YYYY-MM format
   * @returns {string} Current month (e.g., "2026-05")
   */
  getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  },

  /**
   * Get human-readable month label from YYYY-MM string
   * @param {string} monthStr - Month in YYYY-MM format
   * @returns {string} Month label (e.g., "Mei 2026")
   */
  getMonthLabel(monthStr) {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  },

  /**
   * Navigate to previous month from a YYYY-MM string
   * @param {string} monthStr - Current month in YYYY-MM format
   * @returns {string} Previous month in YYYY-MM format
   */
  getPrevMonth(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    const d = new Date(year, month - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  /**
   * Navigate to next month from a YYYY-MM string
   * @param {string} monthStr - Current month in YYYY-MM format
   * @returns {string} Next month in YYYY-MM format
   */
  getNextMonth(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    const d = new Date(year, month);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  /**
   * Get the start and end Date objects for a given month
   * @param {string} monthStr - Month in YYYY-MM format
   * @returns {{ start: Date, end: Date }} Start (1st 00:00:00) and end (last day 23:59:59.999)
   */
  getMonthRange(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  },

  /**
   * Generate a unique ID using timestamp + random string
   * @returns {string} Unique identifier
   */
  generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Show a toast notification message
   * Requires DOM elements with id="toast" and id="toast-message"
   * @param {string} message - Message to display
   */
  showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  },

  /**
   * Create a debounced version of a function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Debounce delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Attach a live-formatting listener to an amount input field
   * Formats the value with thousand separators as the user types
   * @param {HTMLInputElement} input - The input element to enhance
   */
  formatAmountInput(input) {
    input.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value) {
        e.target.value = Utils.formatNumber(parseInt(value));
      }
    });
  },

  /**
   * Get today's date in YYYY-MM-DD ISO format
   * @returns {string} Today's date (e.g., "2026-05-26")
   */
  getTodayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  /**
   * Chart.js color palette for category charts
   * @type {string[]}
   */
  chartColors: [
    '#FF3366', '#20E3B2', '#FADB5F', '#F78C6B', '#8338EC',
    '#3A86FF', '#00F5D4', '#F15BB5', '#9D4EDD', '#FF006E',
    '#8CB369', '#F4E285'
  ],

  /**
   * Animate a counter element from 0 up to a target value
   * Uses ease-out cubic easing for smooth deceleration
   * @param {HTMLElement} element - The DOM element to update
   * @param {number} targetValue - The final value to count up to
   * @param {number} [duration=800] - Animation duration in milliseconds
   */
  animateCounter(element, targetValue, duration = 800) {
    const startValue = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(startValue + (targetValue - startValue) * eased);
      element.textContent = Utils.formatCurrency(currentValue);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }
};
