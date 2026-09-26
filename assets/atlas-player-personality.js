(function () {
  'use strict';

  const RESULT_KEY = 'atlas:personality_test_v1:result';
  const CARD_ID = 'atlas-player-personality-card';

  const TYPES = {
    captain: {
      title: 'THE CAPTAIN',
      quote: 'кто-то должен был взять ответственность на себя.',
      accent: '#e8ac6b'
    },
    wildcard: {
      title: 'THE WILDCARD',
      quote: 'тогда это казалось хорошей идеей.',
      accent: '#b7d776'
    },
    anchor: {
      title: 'THE ANCHOR',
      quote: 'каждому нужно место, куда можно вернуться.',
      accent: '#69c8b5'
    },
    prodigy: {
      title: 'THE PRODIGY',
      quote: 'хорошо — не значит достаточно хорошо.',
      accent: '#90bafa'
    },
    ghost: {
      title: 'THE GHOST',
      quote: 'ты меня знаешь. просто не всего.',
      accent: '#b6a0dd'
    },
    spark: {
      title: 'THE SPARK',
      quote: 'достаточно одного импульса.',
      accent: '#ef897d'
    }
  };

  function readResult() {
    try {
      const value = JSON.parse(localStorage.getItem(RESULT_KEY));
      if (!value || value.version !== 'personality_test_v1' || !TYPES[value.primary_type]) return null;
      return value;
    } catch (_) {
      return null;
    }
  }

  function openTest() {
    if (typeof window.atlasOpenPage === 'function') {
      window.atlasOpenPage('personality-test');
      return;
    }
    location.hash = 'personality-test';
  }

  function styleOnce() {
    if (document.getElementById('atlas-player-personality-style')) return;
    const style = document.createElement('style');
    style.id = 'atlas-player-personality-style';
    style.textContent = `
      #${CARD_ID}{
        --personality-accent:#ff5353;
        position:relative;
        min-height:176px;
        border:1px solid var(--border-color,rgba(255,255,255,.12));
        border-radius:22px;
        background:var(--card-bg,#11161c);
        padding:22px 24px 21px;
        overflow:hidden;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
      }
      #${CARD_ID}::before{
        content:"";
        position:absolute;
        inset:0 auto 0 0;
        width:3px;
        background:var(--personality-accent);
        opacity:.95;
      }
      #${CARD_ID} .apc-kicker{
        margin:0 0 13px;
        font-size:11px;
        line-height:1;
        letter-spacing:.13em;
        text-transform:uppercase;
        font-weight:800;
        color:var(--personality-accent);
      }
      #${CARD_ID} .apc-title{
        margin:0;
        font-size:clamp(25px,2.2vw,39px);
        line-height:.98;
        letter-spacing:-.035em;
        font-weight:900;
        color:var(--personality-accent);
      }
      #${CARD_ID} .apc-copy{
        max-width:560px;
        margin:12px 0 0;
        color:var(--text-muted,#9aa3af);
        font-size:13px;
        line-height:1.55;
      }
      #${CARD_ID} .apc-quote{
        max-width:620px;
        margin:13px 0 0;
        color:var(--text-main,#f4f5f7);
        font-family:Georgia,"Times New Roman",serif;
        font-size:17px;
        line-height:1.45;
        font-style:italic;
      }
      #${CARD_ID} .apc-bottom{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        margin-top:20px;
      }
      #${CARD_ID} .apc-meta{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      #${CARD_ID} .apc-pill{
        border:1px solid rgba(255,255,255,.11);
        border-radius:999px;
        padding:6px 9px;
        color:var(--text-muted,#9aa3af);
        font-size:10px;
        line-height:1;
      }
      #${CARD_ID} .apc-main,
      #${CARD_ID} .apc-retake{
        appearance:none;
        border:0;
        background:none;
        font:inherit;
        cursor:pointer;
      }
      #${CARD_ID} .apc-main{
        border-radius:11px;
        background:var(--personality-accent);
        color:#101214;
        padding:11px 15px;
        font-size:12px;
        font-weight:850;
        white-space:nowrap;
      }
      #${CARD_ID} .apc-retake{
        padding:4px 0 2px 10px;
        color:var(--text-muted,#9aa3af);
        font-size:10px;
        line-height:1.2;
        white-space:nowrap;
        text-decoration:none;
      }
      #${CARD_ID} .apc-retake:hover{color:var(--personality-accent)}
      @media(max-width:760px){
        #${CARD_ID}{min-height:165px;padding:20px}
        #${CARD_ID} .apc-bottom{align-items:flex-start;flex-direction:column}
        #${CARD_ID} .apc-retake{align-self:flex-end}
      }
    `;
    document.head.appendChild(style);
  }

  function findActivityCard() {
    const nodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,strong,b,div,span,p'));
    const heading = nodes.find(el => {
      const text = (el.textContent || '').trim().toUpperCase();
      return text === 'АКТИВНОСТЬ' && el.children.length === 0;
    });
    if (!heading) return null;

    const headingRect = heading.getBoundingClientRect();
    const candidates = [];
    let node = heading.parentElement;

    for (let i = 0; i < 9 && node; i++, node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      const text = (node.textContent || '').toUpperCase();

      if (
        rect.width > 300 &&
        rect.height > 110 &&
        text.includes('АКТИВНОСТЬ') &&
        rect.left <= headingRect.left + 40 &&
        rect.right >= headingRect.right - 40
      ) {
        candidates.push({node, rect, area:rect.width * rect.height});
      }
    }

    if (!candidates.length) return null;

    /*
      Не берём общий двухколоночный контейнер профиля.
      Нужна именно правая карточка/колонка, поэтому предпочитаем
      самый маленький подходящий ancestor, который начинается
      примерно там же, где заголовок "АКТИВНОСТЬ".
    */
    const sameColumn = candidates.filter(({rect}) =>
      Math.abs(rect.left - headingRect.left) < 80
    );

    const pool = sameColumn.length ? sameColumn : candidates;
    pool.sort((a,b) => a.area - b.area);

    return pool[0].node;
  }

  function renderCard(card) {
    const result = readResult();

    if (!result) {
      card.style.setProperty('--personality-accent', '#ff5353');
      card.innerHTML = `
        <div>
          <p class="apc-kicker">твой архетип</p>
          <h3 class="apc-title">УЗНАЙ СВОЙ ТИП</h3>
          <p class="apc-copy">пройди тест и узнай, какой архетип Кастельмары тебе ближе.</p>
        </div>
        <div class="apc-bottom">
          <div class="apc-meta">
            <span class="apc-pill">24 вопроса</span>
            <span class="apc-pill">~20 минут</span>
          </div>
          <button class="apc-main" type="button">пройти тест →</button>
        </div>`;
      card.querySelector('.apc-main').addEventListener('click', openTest);
      return;
    }

    const type = TYPES[result.primary_type];
    card.style.setProperty('--personality-accent', type.accent);
    card.innerHTML = `
      <div>
        <p class="apc-kicker">твой архетип</p>
        <h3 class="apc-title">${type.title}</h3>
        <p class="apc-quote">${type.quote}</p>
      </div>
      <div class="apc-bottom">
        <div></div>
        <button class="apc-retake" type="button">пройти тест заново ↗</button>
      </div>`;
    card.querySelector('.apc-retake').addEventListener('click', openTest);
  }

  function ensureCard() {
    styleOnce();

    const hash = (location.hash || '').toLowerCase();
    if (hash && !hash.includes('player-profile')) {
      const old = document.getElementById(CARD_ID);
      if (old) old.remove();
      return;
    }

    const activity = findActivityCard();
    if (!activity || !activity.parentElement) return;

    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('section');
      card.id = CARD_ID;
      card.setAttribute('aria-label', 'Архетип игрока');

      // Place directly under the activity card inside the same right column.
      const column = activity.parentElement;
      if (!column) return;
      if (getComputedStyle(column).display !== 'flex') {
        column.style.display = 'flex';
        column.style.flexDirection = 'column';
      }
      activity.insertAdjacentElement('afterend', card);
      card.style.width = '100%';
      card.style.marginTop = '14px';
    } else if (card.previousElementSibling !== activity) {
      activity.insertAdjacentElement('afterend', card);
    }

    renderCard(card);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureCard();
    });
  }

  window.addEventListener('hashchange', schedule);
  window.addEventListener('storage', event => {
    if (event.key === RESULT_KEY) schedule();
  });
  window.addEventListener('message', event => {
    if (event.origin === window.location.origin && event.data?.type === 'atlas-personality-complete') schedule();
  });

  new MutationObserver(schedule).observe(document.documentElement, {
    childList:true,
    subtree:true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, {once:true});
  } else {
    schedule();
  }
})();