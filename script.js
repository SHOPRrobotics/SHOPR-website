(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Footer year */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* Mobile menu */
  var menuToggle = document.querySelector(".menu-toggle");
  var mainNav = document.querySelector(".main-nav");
  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", function () {
      var open = mainNav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    mainNav.addEventListener("click", function (e) {
      if (e.target.closest("a") && mainNav.classList.contains("is-open")) {
        mainNav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Pause SMIL animations when the user prefers reduced motion */
  if (reduceMotion) {
    document.querySelectorAll("svg").forEach(function (svg) {
      if (typeof svg.pauseAnimations === "function") svg.pauseAnimations();
    });
  }

  /* Section activation: play each section's animation when it comes into view */
  var holdSections = Array.prototype.slice.call(document.querySelectorAll("[data-hold]"));
  if (holdSections.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            entry.target.classList.add("is-active");
          } else if (!entry.isIntersecting) {
            entry.target.classList.remove("is-active");
          }
        });
      },
      { threshold: [0, 0.35] }
    );
    holdSections.forEach(function (el) {
      io.observe(el);
    });
  }

  /* Scroll hold
   * When scrolling down past a [data-hold] section's top edge, the page is
   * pinned there for data-hold milliseconds so the section's animation can
   * play, then released. Scrolling up is never held. Only enabled for mouse /
   * trackpad input: touch scrolling can't be paused cleanly, and reduced-motion
   * users skip it entirely.
   */
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (holdSections.length && finePointer && !reduceMotion) {
    initScrollHold(holdSections);
  }

  function initScrollHold(sections) {
    var header = document.querySelector(".site-header");
    var holds = sections.map(function (el) {
      return { el: el, armed: true, ms: Number(el.getAttribute("data-hold")) || 800 };
    });
    var lock = null;
    var lastY = window.scrollY;
    var suppressUntil = location.hash ? performance.now() + 1500 : 0;
    var touchStartY = null;

    function headerOffset() {
      return header ? header.offsetHeight : 0;
    }

    function pin(y) {
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    }

    function engage(hold, y) {
      lock = { y: y, el: hold.el, timer: 0 };
      hold.armed = false;
      pin(y);
      hold.el.classList.remove("is-active");
      // Force a reflow so the animation restarts even if it was mid-way.
      void hold.el.offsetWidth;
      hold.el.classList.add("is-active");
      hold.el.classList.add("is-held");
      document.documentElement.classList.add("is-scroll-held");
      lock.timer = window.setTimeout(release, hold.ms);
    }

    function release() {
      if (!lock) return;
      window.clearTimeout(lock.timer);
      lock.el.classList.remove("is-held");
      document.documentElement.classList.remove("is-scroll-held");
      lastY = lock.y;
      lock = null;
    }

    window.addEventListener(
      "scroll",
      function () {
        var y = window.scrollY;
        if (lock) {
          if (Math.abs(y - lock.y) > 0.5) pin(lock.y);
          return;
        }
        var down = y > lastY;
        if (performance.now() >= suppressUntil) {
          for (var i = 0; i < holds.length; i++) {
            var h = holds[i];
            var triggerY = Math.round(h.el.getBoundingClientRect().top + y - headerOffset());
            if (down && h.armed && lastY < triggerY && y >= triggerY) {
              // If the user flew far past the trigger in one go, let them keep going.
              if (y - triggerY <= window.innerHeight * 0.6) {
                engage(h, triggerY);
                return;
              }
              h.armed = false;
            } else if (!down && y < triggerY - 160) {
              h.armed = true;
            }
          }
        }
        lastY = y;
      },
      { passive: true }
    );

    window.addEventListener(
      "wheel",
      function (e) {
        if (!lock) return;
        if (e.deltaY < 0) {
          release();
          return;
        }
        e.preventDefault();
      },
      { passive: false }
    );

    window.addEventListener(
      "keydown",
      function (e) {
        if (!lock) return;
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        var downKeys = ["ArrowDown", "PageDown", "End", " ", "Spacebar"];
        var upKeys = ["ArrowUp", "PageUp", "Home"];
        if (upKeys.indexOf(e.key) !== -1 || (e.key === " " && e.shiftKey)) {
          release();
        } else if (downKeys.indexOf(e.key) !== -1) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener(
      "touchstart",
      function (e) {
        touchStartY = e.touches.length ? e.touches[0].clientY : null;
      },
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      function (e) {
        if (!lock || touchStartY === null || !e.touches.length) return;
        if (e.touches[0].clientY > touchStartY + 6) {
          release();
          return;
        }
        e.preventDefault();
      },
      { passive: false }
    );

    // Don't hold during in-page anchor navigation.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      release();
      suppressUntil = performance.now() + 1500;
      holds.forEach(function (h) {
        h.armed = false;
      });
      lastY = window.scrollY;
    });

    window.addEventListener("resize", function () {
      lastY = window.scrollY;
    });
  }

  /* Contact form
   * Messages are relayed by FormSubmit (https://formsubmit.co) to the address
   * below. There is no backend on this site. The first message sent triggers a
   * one-time activation email to that inbox; nothing is delivered until the
   * link in it is clicked. If the relay is unreachable, the visitor is offered
   * a pre-filled mailto: link to the same address instead.
   */
  var CONTACT_RECIPIENT = "jesse@shoprrobotics.com";
  var CONTACT_ENDPOINT = "https://formsubmit.co/ajax/" + CONTACT_RECIPIENT;

  var form = document.getElementById("contact-form");
  if (form) initContactForm(form);

  function initContactForm(form) {
    var statusEl = document.getElementById("form-status");
    var successEl = document.getElementById("form-success");
    var successCopy = document.getElementById("success-copy");
    var submitBtn = document.getElementById("submit-btn");
    var recipient = CONTACT_RECIPIENT;

    // Returned here by the no-JS fallback redirect.
    if (/[?&]sent=1/.test(location.search)) {
      showSuccess();
      if (history.replaceState) history.replaceState(null, "", location.pathname);
    }

    function showSuccess(name, email) {
      form.hidden = true;
      successEl.hidden = false;
      if (name && email) {
        successCopy.textContent = "Thanks, " + name + ". We'll reply to " + email + ".";
      }
      successEl.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    }

    function setStatus(text, isError) {
      statusEl.textContent = text;
      statusEl.classList.toggle("is-error", Boolean(isError));
    }

    function fieldValue(id) {
      var el = form.querySelector("#" + id);
      return el ? el.value.trim() : "";
    }

    function validate() {
      var required = [
        ["name", "Please enter your name."],
        ["store", "Please enter the store or company you're reaching out on behalf of."],
        ["email", "Please enter a reply-to email address."],
        ["message", "Please write a short message."]
      ];
      for (var i = 0; i < required.length; i++) {
        var el = form.querySelector("#" + required[i][0]);
        if (!el.value.trim()) {
          el.focus();
          setStatus(required[i][1], true);
          return false;
        }
      }
      var emailEl = form.querySelector("#email");
      if (!emailEl.checkValidity()) {
        emailEl.focus();
        setStatus("Please enter a valid reply-to email address.", true);
        return false;
      }
      return true;
    }

    function mailtoFallback(payload) {
      var body =
        "Name: " + payload.name + "\n" +
        "Store / company: " + payload.store + "\n" +
        "Reply-to: " + payload.email + "\n" +
        (payload.phone ? "Phone: " + payload.phone + "\n" : "") +
        "\n" + payload.message;
      return "mailto:" + recipient +
        "?subject=" + encodeURIComponent(payload._subject) +
        "&body=" + encodeURIComponent(body);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      if (form.querySelector('[name="_honey"]').value) return; // bot

      var payload = {
        name: fieldValue("name"),
        store: fieldValue("store"),
        email: fieldValue("email"),
        phone: fieldValue("phone"),
        message: fieldValue("message"),
        _subject: "SHOPR website inquiry from " + fieldValue("store"),
        _replyto: fieldValue("email"),
        _template: "table",
        _captcha: "false"
      };

      submitBtn.disabled = true;
      setStatus("Sending…", false);

      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timeout = window.setTimeout(function () {
        if (controller) controller.abort();
      }, 12000);

      fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          var success = result.ok && String(result.data && result.data.success) === "true";
          if (!success) throw new Error((result.data && result.data.message) || "Send failed");
          setStatus("", false);
          form.reset();
          showSuccess(payload.name, payload.email);
        })
        .catch(function () {
          var href = mailtoFallback(payload);
          statusEl.classList.add("is-error");
          statusEl.innerHTML = "";
          statusEl.appendChild(document.createTextNode("We couldn't send that just now. "));
          var link = document.createElement("a");
          link.href = href;
          link.className = "text-link";
          link.textContent = "Send it from your email app instead";
          statusEl.appendChild(link);
          statusEl.appendChild(document.createTextNode(", or try again in a moment."));
        })
        .finally(function () {
          window.clearTimeout(timeout);
          submitBtn.disabled = false;
        });
    });
  }
})();
