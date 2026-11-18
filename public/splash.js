// 첫 화면(스플래시) 마무리 — lse-market-news와 같은 동작: 누르기·키·스크롤이면 바로 건너뛰고, 재생이 끝나면 덮개를 걷는다.
// 재생 여부는 index.html <head>의 작은 스크립트가 html.no-splash로 정한다. JS가 없어도 splash.css가 스스로 사라진다.
(function () {
  "use strict";
  var root = document.documentElement;
  var sp = document.getElementById("splash");
  if (root.classList.contains("no-splash") || !sp) return;

  var EVENTS = ["pointerdown", "keydown", "wheel", "touchmove"];
  function off() {
    EVENTS.forEach(function (t) { document.removeEventListener(t, done, true); });
  }
  // 폰에서 덮개를 누른 손가락의 click이 덮개가 걷힌 뒤 아래 링크(원문 보기 등)에 떨어지지 않게 잠깐 막는다
  function swallowNextClick() {
    function eat(e) { e.preventDefault(); e.stopPropagation(); }
    document.addEventListener("click", eat, true);
    setTimeout(function () { document.removeEventListener("click", eat, true); }, 600);
  }
  function onScreen() {
    var cs = window.getComputedStyle(sp);
    return cs.display !== "none" && cs.visibility === "visible";
  }
  function done(e) {
    // 덮개가 실제로 화면에 있을 때만 막는다 (CSS가 이미 숨겼다면 그 탭은 페이지를 누른 진짜 탭)
    if (e && e.type === "pointerdown" && onScreen()) swallowNextClick();
    root.classList.add("splash-done");
    off();
  }
  // 누르기·키 입력·스크롤(휠·손가락)이면 바로 건너뛴다
  EVENTS.forEach(function (t) { document.addEventListener(t, done, { capture: true, passive: true }); });
  // CSS가 덮개를 숨기는 순간(보통 3.5초, 동작 줄이기 0.7초)에 바로 정리한다
  sp.addEventListener("animationend", function (ev) { if (ev.target === sp) done(); });
  // CSS 타임라인(3.5초)이 끝난 뒤 덮개를 아예 걷는다. defer로 늦게 돌아도 CSS가 먼저 숨기므로 문제없다
  setTimeout(done, 3550);
})();
