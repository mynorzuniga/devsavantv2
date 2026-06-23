  // ── Panel animator — single synchronized CSS-transition timeline ─────────────
  // Every animated property (heights, link transforms, fonts, paddings, flex-basis,
  // margins, colors) runs on the SAME duration + easing, committed in one frame, so
  // nothing "grows then snaps". Heights are measured as pixels from both resting
  // states; we snap to the START pixels, then transition to the END pixels, then
  // settle back into resting flex so layout stays robust (and no bottom margin).
  window.dsAnimate = (function() {
    var agentOpen = false;
    var animating = false;
    var twoColW = 0;
    var hasMessages = false;
    var renderChipsCb = null;
    var cleanupTimer = 0;

    var DUR = 1000;
    var EZ  = 'cubic-bezier(0.45,0,0.18,1)';
    var ET  = DUR + 'ms ' + EZ;
    var PO  = 'clamp(18px,1.8vw,30px)';   // open padding-left  (= right-side gap)
    var PC  = 'clamp(36px,4vw,56px)';     // closed padding-left
    var GO  = 'clamp(18px,1.8vw,30px)';   // gap above the open window
    var FB_OPEN   = 'clamp(300px,26vw,420px)';
    var FB_CLOSED = 'clamp(280px,24vw,400px)';

    function els() {
      return {
        aside:  document.getElementById('left-aside'),
        nav:    document.getElementById('main-nav'),
        cta:    document.getElementById('contact-btn'),
        logo:   document.getElementById('logo-img'),
        widget: document.getElementById('ask-widget'),
        tr:     document.getElementById('ask-trigger-row'),
        pi:     document.getElementById('ask-panel-inner'),
        tsp:    document.getElementById('nav-top-spacer'),
        bsp:    document.getElementById('nav-spacer')
      };
    }

    function animate(opening) {
      var e = els();
      var aside = e.aside, nav = e.nav, cta = e.cta, logo = e.logo,
          widget = e.widget, tr = e.tr, pi = e.pi, tsp = e.tsp, bsp = e.bsp;
      var links = nav ? [].slice.call(nav.querySelectorAll('.nav-link')) : [];
      if (!aside || !nav || !widget || links.length < 6) return;

      clearTimeout(cleanupTimer);

      // Sizes only (never flex-direction / display)
      function setNav(compressed) {
        if (compressed) {
          nav.style.gap = '5px'; nav.style.paddingTop = 'clamp(10px,1.5vh,18px)';
          links.forEach(function(l) { l.style.fontSize = '12px'; });
          if (cta) { cta.style.fontSize = '10px'; cta.style.padding = '5px 11px'; cta.style.marginTop = '6px'; }
          if (logo) logo.style.height = '28px';
        } else {
          nav.style.gap = 'clamp(16px,2.3vh,30px)'; nav.style.paddingTop = '0px';
          links.forEach(function(l) { l.style.fontSize = 'clamp(17px,1.4vw,24px)'; });
          if (cta) { cta.style.fontSize = 'clamp(13px,1vw,16px)'; cta.style.padding = '9px 18px'; cta.style.marginTop = 'clamp(8px,1.4vh,18px)'; }
          if (logo) logo.style.height = 'clamp(52px,6.5vh,82px)';
        }
      }

      var allTransEls = [aside, nav, logo, widget, tr, tsp, bsp].concat(cta ? [cta] : []).concat(links);
      function killTrans() { allTransEls.forEach(function(el) { if (el) el.style.transition = 'none'; }); }

      // ════════ 1. Kill transitions + the nav-enter fill that pins link transforms ════════
      links.forEach(function(k) { k.style.animation = 'none'; });
      killTrans();
      nav.style.overflow = 'visible';
      void aside.offsetHeight;

      // ════════ 2. Measure the two-column geometry in COMPRESSED single-col layout ════════
      setNav(true);
      links.forEach(function(k) { k.style.transform = 'none'; });
      nav.style.height = 'auto';
      void aside.offsetHeight;
      var cnr = nav.getBoundingClientRect();
      var cr  = links.map(function(k) { var r = k.getBoundingClientRect(); return { x: r.left - cnr.left, y: r.top - cnr.top }; });
      var navW = cnr.width;
      var colW = Math.max(navW * 0.54, 60);
      twoColW = colW;
      var ft = links.map(function(_, i) {                 // two-column end transforms
        return i >= 3 ? { x: colW, y: cr[i - 3].y - cr[i].y } : { x: 0, y: 0 };
      });
      var twoColNavH = links[2].getBoundingClientRect().bottom - nav.getBoundingClientRect().top; // 3 small rows

      // ════════ 3a. Measure OPEN resting geometry (px) ════════
      setNav(true);
      tsp.style.flex = '0 0 auto'; tsp.style.maxHeight = 'none'; tsp.style.height = '0px';
      bsp.style.flex = '0 0 auto'; bsp.style.maxHeight = 'none'; bsp.style.height = '0px';
      aside.style.flexBasis = FB_OPEN; aside.style.paddingLeft = PO;
      nav.style.height = twoColNavH.toFixed(1) + 'px';
      widget.style.flex = '1 1 0'; widget.style.height = 'auto'; widget.style.marginTop = GO;
      if (tr) tr.style.height = '0px';
      void aside.offsetHeight;
      var openWH = widget.getBoundingClientRect().height;

      // ════════ 3b. Measure CLOSED resting geometry (px) ════════
      setNav(false);
      links.forEach(function(k) { k.style.transform = 'none'; });
      tsp.style.flex = '1 1 auto'; tsp.style.maxHeight = '100vh'; tsp.style.height = 'auto';
      bsp.style.flex = '1 1 auto'; bsp.style.maxHeight = '100vh'; bsp.style.height = 'auto';
      aside.style.flexBasis = FB_CLOSED; aside.style.paddingLeft = PC;
      nav.style.height = 'auto';
      widget.style.flex = '0 0 auto'; widget.style.height = '58px'; widget.style.marginTop = '0px';
      if (tr) tr.style.height = '58px';
      void aside.offsetHeight;
      var closedNavH = nav.getBoundingClientRect().height;
      var closedTsp  = tsp.getBoundingClientRect().height;
      var closedBsp  = bsp.getBoundingClientRect().height;

      // ════════ 4. Resolve START / END pixel values ════════
      var startWH   = opening ? 58          : openWH;
      var endWH     = opening ? openWH      : 58;
      var startNavH = opening ? closedNavH  : twoColNavH;
      var endNavH   = opening ? twoColNavH  : closedNavH;
      var startTsp  = opening ? closedTsp   : 0;
      var endTsp    = opening ? 0           : closedTsp;
      var startBsp  = opening ? closedBsp   : 0;
      var endBsp    = opening ? 0           : closedBsp;

      // ════════ 5. Snap to START state (transitions still off) ════════
      killTrans();
      setNav(!opening);
      tsp.style.flex = '0 0 auto'; tsp.style.maxHeight = 'none'; tsp.style.height = startTsp.toFixed(1) + 'px';
      bsp.style.flex = '0 0 auto'; bsp.style.maxHeight = 'none'; bsp.style.height = startBsp.toFixed(1) + 'px';
      aside.style.flexBasis   = opening ? FB_CLOSED : FB_OPEN;
      aside.style.paddingLeft = opening ? PC : PO;
      nav.style.height        = startNavH.toFixed(1) + 'px';
      widget.style.flex = '0 0 auto'; widget.style.height = startWH.toFixed(1) + 'px';
      widget.style.marginTop  = opening ? '0px' : GO;
      widget.style.borderColor = opening ? 'rgba(199,255,224,0.38)' : 'rgba(199,255,224,0.13)';
      widget.style.background  = opening ? 'rgba(0,0,0,0.40)'        : 'rgba(0,0,0,0.22)';
      links.forEach(function(k, i) {
        k.style.transform = (!opening && i >= 3)
          ? 'translate(' + ft[i].x.toFixed(1) + 'px,' + ft[i].y.toFixed(1) + 'px)'
          : 'none';
      });
      if (tr) { tr.style.height = opening ? '58px' : '0px'; tr.style.opacity = opening ? '1' : '0'; }
      if (opening && pi) { pi.style.opacity = '0'; pi.style.pointerEvents = 'none'; }
      void aside.offsetHeight;   // COMMIT start frame

      // ════════ 6. Enable transitions (one timeline for all props) ════════
      nav.style.transition    = 'gap ' + ET + ', padding-top ' + ET + ', height ' + ET;
      if (logo) logo.style.transition = 'height ' + ET;
      links.forEach(function(l) { l.style.transition = 'font-size ' + ET + ', transform ' + ET; });
      if (cta) cta.style.transition = 'font-size ' + ET + ', padding ' + ET + ', margin-top ' + ET;
      aside.style.transition  = 'flex-basis ' + ET + ', padding-left ' + ET;
      widget.style.transition = 'height ' + ET + ', margin-top ' + ET + ', background 0.6s ease, border-color 0.6s ease';
      tsp.style.transition    = 'height ' + ET;
      bsp.style.transition    = 'height ' + ET;
      if (tr) tr.style.transition = 'height ' + ET + ', opacity 0.35s ease';

      animating = true;

      // ════════ 7. Next frame: set END values → everything animates together ════════
      requestAnimationFrame(function() {
        setNav(opening);
        tsp.style.height = endTsp.toFixed(1) + 'px';
        bsp.style.height = endBsp.toFixed(1) + 'px';
        aside.style.flexBasis   = opening ? FB_OPEN : FB_CLOSED;
        aside.style.paddingLeft = opening ? PO : PC;
        nav.style.height        = endNavH.toFixed(1) + 'px';
        widget.style.height     = endWH.toFixed(1) + 'px';
        widget.style.marginTop  = opening ? GO : '0px';
        widget.style.borderColor = opening ? 'rgba(199,255,224,0.13)' : 'rgba(199,255,224,0.38)';
        widget.style.background  = opening ? 'rgba(0,0,0,0.22)'        : 'rgba(0,0,0,0.40)';
        links.forEach(function(k, i) {
          k.style.transform = (opening && i >= 3)
            ? 'translate(' + ft[i].x.toFixed(1) + 'px,' + ft[i].y.toFixed(1) + 'px)'
            : 'none';
        });
        if (tr) { tr.style.height = opening ? '0px' : '58px'; tr.style.opacity = opening ? '0' : '1'; tr.style.pointerEvents = opening ? 'none' : 'auto'; }
        if (!opening && pi) { pi.style.opacity = '0'; pi.style.pointerEvents = 'none'; }

        // Fade panel content in partway through the open
        if (opening && pi) {
          setTimeout(function() {
            pi.style.transition = 'opacity 0.45s ease';
            pi.style.opacity = '1';
            pi.style.pointerEvents = 'auto';
            if (!hasMessages && renderChipsCb) renderChipsCb();
            setTimeout(function() { var inp = document.getElementById('agent-input'); if (inp) inp.focus(); }, 40);
          }, Math.round(DUR * 0.5));
        }
      });

      // ════════ 8. Settle into resting flex so layout is robust (no bottom margin) ════════
      cleanupTimer = setTimeout(function() {
        animating = false;
        killTrans();
        if (opening) {
          tsp.style.flex = '0 0 auto'; tsp.style.height = '0px'; tsp.style.maxHeight = '0px';
          bsp.style.flex = '0 0 auto'; bsp.style.height = '0px'; bsp.style.maxHeight = '0px';
          widget.style.flex = '1 1 0'; widget.style.height = 'auto';   // fill → no margin, resize-safe
          if (tr) tr.style.height = '0px';
        } else {
          tsp.style.flex = '1 1 auto'; tsp.style.height = 'auto'; tsp.style.maxHeight = '100vh';
          bsp.style.flex = '1 1 auto'; bsp.style.height = 'auto'; bsp.style.maxHeight = '100vh';
          widget.style.flex = '0 0 auto'; widget.style.height = '58px';
          if (tr) tr.style.height = '58px';
          nav.style.height = 'auto';
          links.forEach(function(k) { k.style.transform = ''; });
        }
        void aside.offsetHeight;
      }, DUR + 50);
    }

    return {
      open: function(chipsCb) {
        if (agentOpen || animating) return;
        agentOpen = true;
        renderChipsCb = chipsCb;
        animate(true);
      },
      close: function() {
        if (!agentOpen || animating) return;
        agentOpen = false;
        animate(false);
      },
      setHasMessages: function(v) { hasMessages = v; }
    };
  })();
