const PATHS = {
  paper: "data/paper.generated.json",
  site: "config/site.json",
  media: "data/media.json",
};

const escapeHtml = (value = "") =>
  String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );

const formatValue = (value) => (typeof value === "number" ? value.toFixed(1) : value);

function actionButton(label, url, primary = false) {
  if (!url) return "";
  return `<a class="button${primary ? " primary" : ""}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`;
}

function paperFigure(figure, extraClass = "") {
  if (!figure?.path) return "";
  return `
    <figure class="paper-figure ${extraClass}">
      <img loading="lazy" src="${escapeHtml(figure.path)}" alt="${escapeHtml(figure.alt)}" />
      <figcaption>${escapeHtml(figure.caption)}</figcaption>
    </figure>`;
}

function sectionIntro(index, eyebrow, title, body) {
  return `
    <div class="section-label">${String(index).padStart(2, "0")} · ${escapeHtml(eyebrow)}</div>
    <div class="section-grid section-intro">
      <h2>${escapeHtml(title)}</h2>
      <p class="lead-copy">${escapeHtml(body)}</p>
    </div>`;
}

function renderHero(paper, site, media) {
  const reviewMode = site.review_mode !== false;
  document.title = `${paper.title} · Project Page`;
  document.querySelector("#paper-title").textContent = paper.title;

  const publicAuthors = site.public_identity?.authors || [];
  document.querySelector("#author-line").innerHTML = reviewMode
    ? `Anonymous Authors <span class="review-badge">Review mode</span>`
    : `${escapeHtml(publicAuthors.join(", "))}${
        site.public_identity?.affiliations?.length
          ? `<span class="affiliation-line">${escapeHtml(site.public_identity.affiliations.join(" · "))}</span>`
          : ""
      }`;

  const links = site.links || {};
  document.querySelector("#hero-actions").innerHTML = [
    actionButton("Paper", links.paper, true),
    !reviewMode && actionButton("Code", links.code),
    !reviewMode && actionButton("Video", links.video),
    !reviewMode && actionButton("arXiv", links.arxiv),
  ]
    .filter(Boolean)
    .join("");

  document.querySelector("#hero-figure").innerHTML = `
    <img src="${escapeHtml(paper.figures.hero.path)}" alt="${escapeHtml(paper.figures.hero.alt)}" />
    <figcaption>${escapeHtml(paper.figures.hero.caption)}</figcaption>`;
  document.querySelector("#hero-media").innerHTML = media.hero_video?.src
    ? `<div class="featured-video">${videoCard(media.hero_video)}</div>`
    : "";

  document.querySelector("#metric-strip").innerHTML = paper.headline_fact_ids
    .map((factId) => paper.facts[factId])
    .map(
      (fact) =>
        `<div class="metric"><strong>${escapeHtml(fact.display)}</strong><span>${escapeHtml(fact.label)}</span></div>`,
    )
    .join("");

  document.querySelector("#abstract-copy").textContent = paper.abstract;
  document.querySelector("#keyword-list").innerHTML = paper.keywords
    .map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`)
    .join("");
  document.querySelector("#introduction-media").innerHTML = media.introduction_video?.src
    ? `<div class="featured-video">${videoCard(media.introduction_video)}</div>`
    : "";
}

function focusVariables(focus = {}) {
  const left = Number(focus.left ?? 0);
  const top = Number(focus.top ?? 0);
  const width = Number(focus.width ?? 100);
  const height = Number(focus.height ?? 100);
  const right = Math.max(0, 100 - left - width);
  const bottom = Math.max(0, 100 - top - height);
  return `--focus-left:${left}%;--focus-top:${top}%;--focus-width:${width}%;--focus-height:${height}%;--focus-right:${right}%;--focus-bottom:${bottom}%`;
}

function renderMethod(paper, media) {
  const method = paper.method;
  const firstStage = method.stages[0];
  return `
    <section class="section" id="method" aria-labelledby="method-heading">
      ${sectionIntro(2, "Approach", method.heading, method.summary).replace("<h2>", '<h2 id="method-heading">')}
      <div class="method-explorer" data-method-explorer data-active-stage="0" style="${focusVariables(firstStage.focus)}">
        <div class="method-sidebar">
          <div class="method-tabs" role="tablist" aria-label="CMAP method stages">
            ${method.stages
              .map(
                (stage, index) => `
                  <button class="method-stage-button${index === 0 ? " is-active" : ""}" type="button" role="tab" aria-selected="${index === 0}" aria-controls="method-stage-copy" data-stage-index="${index}">
                    <span class="method-stage-number">${String(index + 1).padStart(2, "0")}</span>
                    <span><small>${escapeHtml(stage.panel)}</small><strong>${escapeHtml(stage.title)}</strong></span>
                  </button>`,
              )
              .join("")}
          </div>
          <div class="method-stage-copy" id="method-stage-copy" role="tabpanel" aria-live="polite">
            <span data-method-panel>${escapeHtml(firstStage.panel)}</span>
            <h3 data-method-title>${escapeHtml(firstStage.title)}</h3>
            <p data-method-description>${escapeHtml(firstStage.description)}</p>
          </div>
        </div>
        <figure class="paper-figure method-figure">
          <div class="method-figure-image">
            <img class="method-figure-base" src="${escapeHtml(paper.figures.method.path)}" alt="${escapeHtml(paper.figures.method.alt)}" />
            <img class="method-figure-focus" src="${escapeHtml(paper.figures.method.path)}" alt="" aria-hidden="true" />
            <span class="method-focus-frame" aria-hidden="true"></span>
          </div>
          <figcaption><span>Interactive figure</span>${escapeHtml(paper.figures.method.caption)}</figcaption>
        </figure>
      </div>
      ${media.method_video?.src ? `<div class="featured-video">${videoCard(media.method_video)}</div>` : ""}
    </section>`;
}

function resultsTable(table) {
  return `
    <div class="table-card">
      <div class="table-heading">
        <h3>${escapeHtml(table.title)}</h3>
        <span>${escapeHtml(table.unit)}</span>
      </div>
      <div class="table-scroll" tabindex="0">
        <table>
          <thead><tr>${table.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join("")}</tr></thead>
          <tbody>
            ${table.rows
              .map(
                (row) => `<tr class="${row.highlight ? "highlight-row" : ""}">
                  <th scope="row">${escapeHtml(row.method)}</th>
                  ${row.values.map((value) => `<td>${escapeHtml(formatValue(value))}</td>`).join("")}
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="table-note">${escapeHtml(table.note)}</p>
    </div>`;
}

function videoCard(item) {
  return `
    <article class="video-card" data-media-group="${escapeHtml(item.group)}">
      <div class="video-frame">
        <video controls autoplay muted loop playsinline preload="auto" aria-label="${escapeHtml(item.title)} rollout video">
          <source src="${escapeHtml(item.src)}" type="video/mp4" />
        </video>
      </div>
      <div class="video-card-copy">
        <div class="video-card-labels"><span>${escapeHtml(item.group)}</span>${item.type ? `<span>${escapeHtml(item.type)}</span>` : ""}</div>
        <h3>${escapeHtml(item.title)}</h3>
        ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
      </div>
    </article>`;
}

function mediaFilter(videos, gridId) {
  const groups = [...new Set(videos.map((item) => item.group))];
  if (groups.length < 2) return "";
  const controls = [
    {label: "All tasks", value: "all", count: videos.length},
    ...groups.map((group) => ({
      label: group,
      value: group,
      count: videos.filter((item) => item.group === group).length,
    })),
  ];
  return `<div class="media-filter" data-media-filter data-grid-id="${escapeHtml(gridId)}" role="group" aria-label="Filter simulation videos">
    ${controls
      .map(
        (control, index) => `<button type="button" class="filter-button${index === 0 ? " is-active" : ""}" data-filter-value="${escapeHtml(control.value)}" aria-pressed="${index === 0}">${escapeHtml(control.label)} <span>${control.count}</span></button>`,
      )
      .join("")}
  </div>`;
}

function renderSimulation(paper, media) {
  const simulation = paper.simulation;
  const videos = (media.simulation_videos || []).filter((item) => item.src);
  return `
    <section class="section" id="simulation" aria-labelledby="simulation-heading">
      ${sectionIntro(4, "Evaluation", simulation.heading, simulation.summary).replace("<h2>", '<h2 id="simulation-heading">')}
      <div class="results-grid">
        ${simulation.tables.map(resultsTable).join("")}
      </div>
      ${
        videos.length
          ? `<div class="subsection-heading"><div><span>Recorded rollouts</span><h3>Simulation videos</h3></div><p>Twelve selected clips spanning every task, plus one alternate Handover Mic rollout.</p></div>
             ${mediaFilter(videos, "simulation-video-grid")}
             <div class="video-grid simulation-video-grid" id="simulation-video-grid">${videos.map(videoCard).join("")}</div>`
          : ""
      }
    </section>`;
}

function platformCard(platform) {
  return `
    <article class="platform-card">
      <div class="platform-copy">
        <p class="platform-kicker">${escapeHtml(platform.platform)}</p>
        <h3>${escapeHtml(platform.title)}</h3>
        <p>${escapeHtml(platform.description)}</p>
        <ul>${platform.tasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("")}</ul>
      </div>
    </article>`;
}

function renderRealWorldWithMedia(paper, media) {
  const section = paper.real_world;
  const videos = (media.real_robot_videos || []).filter((item) => item.src);
  return `
    <section class="section" id="real-world" aria-labelledby="real-heading">
      ${sectionIntro(3, "Physical deployment", section.heading, section.summary).replace("<h2>", '<h2 id="real-heading">')}
      <div class="platform-list">${section.platforms.map(platformCard).join("")}</div>
      ${
        videos.length
          ? `<div class="subsection-heading"><div><span>Physical rollouts</span><h3>Real-robot videos</h3></div><p>AGIBOT G1 CMAP executions and a clearly labeled Leju Kuavo 4 Pro expert demonstration.</p></div>
             <div class="video-grid real-video-grid">${videos.map(videoCard).join("")}</div>`
          : ""
      }
      ${resultsTable(section.table)}
      <div class="protocol-note">
        <span>Matched protocol</span>
        <p>${escapeHtml(section.protocol)}</p>
      </div>
    </section>`;
}

function ablationItemButtons(view) {
  return view.items
    .map(
      (item, index) => `<button class="ablation-item-button${index === 0 ? " is-active" : ""}" type="button" role="tab" aria-selected="${index === 0}" aria-controls="ablation-detail-panel" data-ablation-item-index="${index}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.label)}</strong></button>`,
    )
    .join("");
}

function ablationMetrics(item) {
  return (item.metrics || [])
    .map(
      (metric) => `<div><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>`,
    )
    .join("");
}

function ablationChartLegend(chart) {
  return (chart?.series || [])
    .map(
      (series) => `<span><i style="--legend-color:${escapeHtml(series.color)}"></i>${escapeHtml(series.label)}</span>`,
    )
    .join("");
}

function formatChartValue(value) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function wrappedCanvasLines(context, label, maxWidth) {
  const words = String(label).split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawCanvasValueTag(context, text, pointX, pointY, color, placement, edge, plot, compact) {
  context.save();
  context.font = `700 ${compact ? 9 : 10}px Inter, system-ui, sans-serif`;
  const tagHeight = compact ? 17 : 19;
  const tagWidth = context.measureText(text).width + (compact ? 9 : 12);
  const verticalOffset = compact ? 15 : 17;
  let centerX = pointX;
  if (edge === "start") centerX += tagWidth / 2 + 9;
  if (edge === "end") centerX -= tagWidth / 2 + 9;
  centerX = Math.min(plot.left + plot.width - tagWidth / 2 - 3, Math.max(plot.left + tagWidth / 2 + 3, centerX));

  let centerY = pointY + (placement === "above" ? -verticalOffset : verticalOffset);
  centerY = Math.min(
    plot.top + plot.height - tagHeight / 2 - 3,
    Math.max(plot.top + tagHeight / 2 + 3, centerY),
  );
  const left = centerX - tagWidth / 2;
  const top = centerY - tagHeight / 2;

  context.globalAlpha = 0.96;
  context.fillStyle = "#ffffff";
  context.fillRect(left, top, tagWidth, tagHeight);
  context.globalAlpha = 1;
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.strokeRect(left + 0.5, top + 0.5, tagWidth - 1, tagHeight - 1);
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, centerX, centerY + 0.5);
  context.restore();
}

function drawAblationChart(canvas, chart, activeIndex, progress = 1) {
  if (!canvas || !chart?.categories?.length || !chart?.series?.length) return;
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(bounds.width));
  const height = width < 620 ? 340 : 410;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.style.height !== `${height}px`) canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  const context = canvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const compact = width < 620;
  const margin = {top: 34, right: compact ? 14 : 26, bottom: compact ? 88 : 78, left: compact ? 48 : 60};
  const plot = {
    left: margin.left,
    top: margin.top,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  const yMin = Number(chart.y_min ?? 0);
  const yMax = Number(chart.y_max ?? 100);
  const yStep = Number(chart.y_step ?? 20);
  const yPosition = (value) => plot.top + plot.height - ((value - yMin) / (yMax - yMin)) * plot.height;
  const categoryCount = chart.categories.length;
  const isLine = chart.type === "line";
  const categoryX = (index) =>
    isLine
      ? plot.left + (categoryCount === 1 ? plot.width / 2 : (index / (categoryCount - 1)) * plot.width)
      : plot.left + ((index + 0.5) / categoryCount) * plot.width;

  context.fillStyle = "#fbfcf9";
  context.fillRect(0, 0, width, height);

  const categoryStep = isLine ? plot.width / Math.max(1, categoryCount - 1) : plot.width / categoryCount;
  const bandWidth = Math.min(categoryStep * 0.82, isLine ? 120 : categoryStep * 0.9);
  context.fillStyle = "rgba(37, 148, 111, 0.08)";
  context.fillRect(categoryX(activeIndex) - bandWidth / 2, plot.top, bandWidth, plot.height);

  context.font = `${compact ? 10 : 11}px Inter, system-ui, sans-serif`;
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (let tick = yMin; tick <= yMax + 0.001; tick += yStep) {
    const y = yPosition(tick);
    context.strokeStyle = tick === yMin ? "#9caaa6" : "#dce4e0";
    context.lineWidth = tick === yMin ? 1.2 : 1;
    context.beginPath();
    context.moveTo(plot.left, y);
    context.lineTo(plot.left + plot.width, y);
    context.stroke();
    context.fillStyle = "#65736f";
    context.fillText(formatChartValue(tick), plot.left - 9, y);
  }

  context.save();
  context.translate(compact ? 13 : 17, plot.top + plot.height / 2);
  context.rotate(-Math.PI / 2);
  context.fillStyle = "#65736f";
  context.font = `${compact ? 9 : 10}px Inter, system-ui, sans-serif`;
  context.textAlign = "center";
  context.fillText(chart.y_label || "Success rate (%)", 0, 0);
  context.restore();

  if (isLine) {
    chart.series.forEach((series) => {
      const pointAt = (index) => ({
        x: categoryX(index),
        y: yPosition(Number(series.values[index])),
      });
      const firstPoint = pointAt(0);
      let activePoint = firstPoint;

      context.strokeStyle = series.color;
      context.lineWidth = 2.6;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(firstPoint.x, firstPoint.y);
      for (let index = 1; index < activeIndex; index += 1) {
        const completedPoint = pointAt(index);
        context.lineTo(completedPoint.x, completedPoint.y);
      }
      if (activeIndex > 0) {
        const previousPoint = pointAt(activeIndex - 1);
        const targetPoint = pointAt(activeIndex);
        activePoint = {
          x: previousPoint.x + (targetPoint.x - previousPoint.x) * progress,
          y: previousPoint.y + (targetPoint.y - previousPoint.y) * progress,
        };
        context.lineTo(activePoint.x, activePoint.y);
        context.stroke();
      }

      for (let index = 0; index < activeIndex; index += 1) {
        const completedPoint = pointAt(index);
        context.beginPath();
        context.fillStyle = "#fbfcf9";
        context.strokeStyle = series.color;
        context.lineWidth = 2;
        context.arc(completedPoint.x, completedPoint.y, 4.5, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }

      context.save();
      context.globalAlpha = activeIndex === 0 ? Math.max(0.15, progress) : 1;
      context.beginPath();
      context.fillStyle = "#fbfcf9";
      context.strokeStyle = series.color;
      context.lineWidth = 3;
      context.arc(activePoint.x, activePoint.y, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.restore();
    });
    if (progress > 0.72) {
      chart.series.forEach((series, seriesIndex) => {
        const value = Number(series.values[activeIndex]);
        const otherValue = Number(chart.series[(seriesIndex + 1) % chart.series.length]?.values?.[activeIndex]);
        const placement = value > otherValue || (value === otherValue && seriesIndex === 0) ? "above" : "below";
        const edge = activeIndex === 0 ? "start" : activeIndex === categoryCount - 1 ? "end" : "middle";
        const previousValue = activeIndex > 0 ? Number(series.values[activeIndex - 1]) : value;
        const animatedValue = previousValue + (value - previousValue) * progress;
        const previousX = categoryX(Math.max(0, activeIndex - 1));
        const animatedX = activeIndex > 0 ? previousX + (categoryX(activeIndex) - previousX) * progress : categoryX(0);
        drawCanvasValueTag(
          context,
          `${formatChartValue(value)}%`,
          animatedX,
          yPosition(animatedValue),
          series.color,
          placement,
          edge,
          plot,
          compact,
        );
      });
    }
  } else {
    const groupWidth = plot.width / categoryCount;
    const usableWidth = groupWidth * (compact ? 0.82 : 0.78);
    const barGap = compact ? 1 : 2;
    const barWidth = Math.max(3, (usableWidth - barGap * (chart.series.length - 1)) / chart.series.length);
    chart.categories.forEach((_, categoryIndex) => {
      if (categoryIndex > activeIndex) return;
      const groupLeft = plot.left + categoryIndex * groupWidth + (groupWidth - usableWidth) / 2;
      chart.series.forEach((series, seriesIndex) => {
        const value = Number(series.values[categoryIndex]);
        const categoryProgress = categoryIndex === activeIndex ? progress : 1;
        const animatedValue = yMin + (value - yMin) * categoryProgress;
        const x = groupLeft + seriesIndex * (barWidth + barGap);
        const y = yPosition(animatedValue);
        const barHeight = plot.top + plot.height - y;
        context.globalAlpha = categoryIndex === activeIndex ? 1 : 0.68;
        context.fillStyle = series.color;
        context.fillRect(x, y, barWidth, barHeight);
        context.globalAlpha = 1;
        if (categoryIndex === activeIndex && progress > 0.72) {
          context.save();
          context.translate(x + barWidth / 2, Math.max(plot.top + 8, y - 4));
          if (compact) context.rotate(-Math.PI / 2);
          context.fillStyle = "#34444a";
          context.font = `700 ${compact ? 8 : 9}px Inter, system-ui, sans-serif`;
          context.textAlign = compact ? "left" : "center";
          context.textBaseline = "bottom";
          context.fillText(formatChartValue(value), 0, 0);
          context.restore();
        }
      });
    });
  }

  context.font = `${compact ? 9 : 10}px Inter, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "top";
  chart.categories.forEach((label, index) => {
    context.fillStyle = index === activeIndex ? "#176d64" : index > activeIndex ? "#a7b2af" : "#5e6e6b";
    context.font = `${index === activeIndex ? "700" : "500"} ${compact ? 9 : 10}px Inter, system-ui, sans-serif`;
    const maxLabelWidth = isLine ? Math.max(62, categoryStep * 0.78) : Math.max(54, plot.width / categoryCount - 10);
    const lines = wrappedCanvasLines(context, label, maxLabelWidth);
    lines.forEach((line, lineIndex) => context.fillText(line, categoryX(index), plot.top + plot.height + 15 + lineIndex * 12));
  });

  canvas._ablationLayout = {left: plot.left, width: plot.width, count: categoryCount, type: chart.type};
}

function renderAblations(paper) {
  const section = paper.ablations;
  const views = section.views || [];
  const firstView = views[0];
  const firstItem = firstView?.items?.[0];
  const firstChart = firstView?.chart;
  return `
    <section class="section" id="ablations" aria-labelledby="ablation-heading">
      ${sectionIntro(5, "Analysis", section.heading, section.summary).replace("<h2>", '<h2 id="ablation-heading">')}
      <div class="ablation-view-tabs" role="tablist" aria-label="Ablation figure views">
        ${views
          .map(
            (view, index) => `<button type="button" role="tab" class="ablation-view-button${index === 0 ? " is-active" : ""}" aria-selected="${index === 0}" aria-controls="ablation-explorer" data-ablation-view-index="${index}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(view.title)}</strong></button>`,
          )
          .join("")}
      </div>
      <div class="ablation-explorer" id="ablation-explorer" data-ablation-explorer>
        <div class="ablation-sidebar">
          <div class="ablation-view-copy">
            <span data-ablation-view-kicker>Interactive ablation</span>
            <h3 data-ablation-view-title>${escapeHtml(firstView?.title)}</h3>
            <p data-ablation-view-description>${escapeHtml(firstView?.description)}</p>
            <button class="ablation-play-button" type="button" data-ablation-play aria-pressed="false"><span aria-hidden="true">▶</span><span data-ablation-play-label>Play sequence</span></button>
          </div>
          <div class="ablation-item-tabs" data-ablation-items role="tablist" aria-label="${escapeHtml(firstView?.title)} selections">
            ${firstView ? ablationItemButtons(firstView) : ""}
          </div>
          <div class="ablation-detail-panel" id="ablation-detail-panel" role="tabpanel" aria-live="polite">
            <span data-ablation-item-eyebrow>${escapeHtml(firstItem?.eyebrow)}</span>
            <h4 data-ablation-item-title>${escapeHtml(firstItem?.label)}</h4>
            <p data-ablation-item-description>${escapeHtml(firstItem?.description)}</p>
            <div class="ablation-metrics" data-ablation-metrics>${firstItem ? ablationMetrics(firstItem) : ""}</div>
          </div>
        </div>
        <div class="ablation-visual">
          <div class="ablation-chart-shell">
            <div class="ablation-chart-heading">
              <div><span data-ablation-chart-kind>${firstChart?.type === "bar" ? "Animated grouped bars" : "Animated line chart"}</span><h4 data-ablation-chart-title>${escapeHtml(firstChart?.title)}</h4></div>
              <p>Click a category to inspect it</p>
            </div>
            <canvas class="ablation-chart-canvas" data-ablation-canvas width="900" height="410" tabindex="0" role="img" aria-label="${escapeHtml(firstChart?.title)}. Interactive chart; use the left and right arrow keys to change the selected category."></canvas>
            <div class="ablation-chart-legend" data-ablation-legend>${ablationChartLegend(firstChart)}</div>
            <p class="ablation-chart-note" data-ablation-chart-note>${escapeHtml(firstChart?.source_note)}</p>
          </div>
        </div>
      </div>
      <p class="evidence-note">${escapeHtml(section.detail)}</p>
    </section>`;
}

function renderCases(paper, media) {
  const section = paper.success_failure;
  const videos = (media.success_failure_videos || []).filter((item) => item.src);
  return `
    <section class="section" id="cases" aria-labelledby="cases-heading">
      ${sectionIntro(6, "Qualitative evidence", section.heading, section.summary).replace("<h2>", '<h2 id="cases-heading">')}
      ${paperFigure(paper.figures.success_failure, "wide-figure")}
      <div class="case-grid">
        ${section.cases
          .map(
            (item) => `<article><span>${escapeHtml(item.task)}</span><h3>${escapeHtml(item.failure)}</h3><p>${escapeHtml(item.description)}</p></article>`,
          )
          .join("")}
      </div>
      ${videos.length ? `<div class="video-grid">${videos.map(videoCard).join("")}</div>` : ""}
      <p class="evidence-note">${escapeHtml(section.extension)}</p>
    </section>`;
}

function renderCitation(paper, site) {
  const reviewMode = site.review_mode !== false;
  const bibtex = site.public_identity?.bibtex;
  return `
    <section class="section citation-section" id="citation" aria-labelledby="citation-heading">
      <div class="section-label">07 · Reference</div>
      <div class="section-grid">
        <h2 id="citation-heading">Citation</h2>
        <div>
          ${
            reviewMode
              ? `<div class="review-panel"><span>Anonymous review</span><p>Citation metadata is intentionally hidden while REVIEW_MODE is enabled.</p></div>`
              : bibtex
                ? `<pre><code>${escapeHtml(bibtex)}</code></pre>`
                : `<div class="review-panel"><span>Publication metadata pending</span><p>Add the final BibTeX entry to the public identity configuration after acceptance.</p></div>`
          }
          ${
            !reviewMode && site.public_identity?.acknowledgment
              ? `<div class="acknowledgment"><span>Acknowledgment</span><p>${escapeHtml(site.public_identity.acknowledgment)}</p></div>`
              : ""
          }
          <p class="source-note">Website content is synchronized from the current manuscript. Last content sync: ${escapeHtml(paper.source.generated_date)}.</p>
        </div>
      </div>
    </section>`;
}

function setupMethodExplorer(method) {
  const explorer = document.querySelector("[data-method-explorer]");
  if (!explorer) return;

  const buttons = [...explorer.querySelectorAll("[data-stage-index]")];
  const panelLabel = explorer.querySelector("[data-method-panel]");
  const title = explorer.querySelector("[data-method-title]");
  const description = explorer.querySelector("[data-method-description]");

  const selectStage = (index, moveFocus = false) => {
    const stage = method.stages[index];
    if (!stage) return;
    const focus = stage.focus || {};
    const left = Number(focus.left ?? 0);
    const top = Number(focus.top ?? 0);
    const width = Number(focus.width ?? 100);
    const height = Number(focus.height ?? 100);

    explorer.dataset.activeStage = String(index);
    explorer.style.setProperty("--focus-left", `${left}%`);
    explorer.style.setProperty("--focus-top", `${top}%`);
    explorer.style.setProperty("--focus-width", `${width}%`);
    explorer.style.setProperty("--focus-height", `${height}%`);
    explorer.style.setProperty("--focus-right", `${Math.max(0, 100 - left - width)}%`);
    explorer.style.setProperty("--focus-bottom", `${Math.max(0, 100 - top - height)}%`);
    panelLabel.textContent = stage.panel;
    title.textContent = stage.title;
    description.textContent = stage.description;

    buttons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    if (moveFocus) buttons[index].focus();
  };

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => selectStage(index));
    button.addEventListener("keydown", (event) => {
      const keyTargets = {
        ArrowDown: (index + 1) % buttons.length,
        ArrowRight: (index + 1) % buttons.length,
        ArrowUp: (index - 1 + buttons.length) % buttons.length,
        ArrowLeft: (index - 1 + buttons.length) % buttons.length,
        Home: 0,
        End: buttons.length - 1,
      };
      if (!(event.key in keyTargets)) return;
      event.preventDefault();
      selectStage(keyTargets[event.key], true);
    });
  });
  selectStage(0);
}

function setupAblationExplorer(section) {
  const explorer = document.querySelector("[data-ablation-explorer]");
  const views = section.views || [];
  if (!explorer || !views.length) return;

  const viewButtons = [...document.querySelectorAll("[data-ablation-view-index]")];
  const viewTitle = explorer.querySelector("[data-ablation-view-title]");
  const viewDescription = explorer.querySelector("[data-ablation-view-description]");
  const itemTabs = explorer.querySelector("[data-ablation-items]");
  const itemEyebrow = explorer.querySelector("[data-ablation-item-eyebrow]");
  const itemTitle = explorer.querySelector("[data-ablation-item-title]");
  const itemDescription = explorer.querySelector("[data-ablation-item-description]");
  const metrics = explorer.querySelector("[data-ablation-metrics]");
  const chartCanvas = explorer.querySelector("[data-ablation-canvas]");
  const chartKind = explorer.querySelector("[data-ablation-chart-kind]");
  const chartTitle = explorer.querySelector("[data-ablation-chart-title]");
  const chartLegend = explorer.querySelector("[data-ablation-legend]");
  const chartNote = explorer.querySelector("[data-ablation-chart-note]");
  const playButton = explorer.querySelector("[data-ablation-play]");
  const playLabel = explorer.querySelector("[data-ablation-play-label]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeViewIndex = 0;
  let activeItemIndex = 0;
  let playTimer = null;
  let animationFrame = null;

  const stopPlayback = () => {
    if (playTimer) window.clearInterval(playTimer);
    playTimer = null;
    playButton.setAttribute("aria-pressed", "false");
    playLabel.textContent = "Play sequence";
    playButton.querySelector("[aria-hidden]").textContent = "▶";
  };

  const renderChart = (progress = 1) => {
    drawAblationChart(chartCanvas, views[activeViewIndex]?.chart, activeItemIndex, progress);
  };

  const animateChart = () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    if (reducedMotion.matches) {
      renderChart(1);
      return;
    }
    const start = performance.now();
    const duration = 760;
    const step = (timestamp) => {
      const elapsed = Math.min(1, (timestamp - start) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      renderChart(eased);
      if (elapsed < 1) animationFrame = window.requestAnimationFrame(step);
      else animationFrame = null;
    };
    animationFrame = window.requestAnimationFrame(step);
  };

  const selectItem = (index, moveFocus = false) => {
    const view = views[activeViewIndex];
    const item = view?.items?.[index];
    if (!item) return;
    const itemButtons = [...itemTabs.querySelectorAll("[data-ablation-item-index]")];

    activeItemIndex = index;
    itemEyebrow.textContent = item.eyebrow;
    itemTitle.textContent = item.label;
    itemDescription.textContent = item.description;
    metrics.innerHTML = ablationMetrics(item);
    animateChart();

    itemButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    if (moveFocus) itemButtons[index].focus();
  };

  const bindItemButtons = () => {
    const itemButtons = [...itemTabs.querySelectorAll("[data-ablation-item-index]")];
    itemButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        stopPlayback();
        selectItem(index);
      });
      button.addEventListener("keydown", (event) => {
        const keyTargets = {
          ArrowRight: (index + 1) % itemButtons.length,
          ArrowDown: (index + 1) % itemButtons.length,
          ArrowLeft: (index - 1 + itemButtons.length) % itemButtons.length,
          ArrowUp: (index - 1 + itemButtons.length) % itemButtons.length,
          Home: 0,
          End: itemButtons.length - 1,
        };
        if (!(event.key in keyTargets)) return;
        event.preventDefault();
        stopPlayback();
        selectItem(keyTargets[event.key], true);
      });
    });
  };

  const startPlayback = () => {
    stopPlayback();
    playButton.setAttribute("aria-pressed", "true");
    playLabel.textContent = "Pause sequence";
    playButton.querySelector("[aria-hidden]").textContent = "Ⅱ";
    playTimer = window.setInterval(() => {
      const itemCount = views[activeViewIndex].items.length;
      selectItem((activeItemIndex + 1) % itemCount);
    }, 2200);
  };

  const selectView = (index, moveFocus = false) => {
    const view = views[index];
    const chart = view?.chart;
    if (!view || !chart) return;
    activeViewIndex = index;
    viewTitle.textContent = view.title;
    viewDescription.textContent = view.description;
    itemTabs.setAttribute("aria-label", `${view.title} selections`);
    itemTabs.innerHTML = ablationItemButtons(view);
    chartKind.textContent = chart.type === "bar" ? "Animated grouped bars" : "Animated line chart";
    chartTitle.textContent = chart.title;
    chartLegend.innerHTML = ablationChartLegend(chart);
    chartNote.textContent = chart.source_note || "";
    chartCanvas.setAttribute(
      "aria-label",
      `${chart.title}. Interactive chart; use the left and right arrow keys to change the selected category.`,
    );

    viewButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    bindItemButtons();
    selectItem(0);
    if (!reducedMotion.matches) startPlayback();
    if (moveFocus) viewButtons[index].focus();
  };

  viewButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      stopPlayback();
      selectView(index);
    });
    button.addEventListener("keydown", (event) => {
      const keyTargets = {
        ArrowRight: (index + 1) % viewButtons.length,
        ArrowDown: (index + 1) % viewButtons.length,
        ArrowLeft: (index - 1 + viewButtons.length) % viewButtons.length,
        ArrowUp: (index - 1 + viewButtons.length) % viewButtons.length,
        Home: 0,
        End: viewButtons.length - 1,
      };
      if (!(event.key in keyTargets)) return;
      event.preventDefault();
      stopPlayback();
      selectView(keyTargets[event.key], true);
    });
  });

  playButton.addEventListener("click", () => {
    if (playTimer) stopPlayback();
    else startPlayback();
  });

  const selectCanvasCategory = (event) => {
    const layout = chartCanvas._ablationLayout;
    if (!layout) return;
    const bounds = chartCanvas.getBoundingClientRect();
    const canvasX = ((event.clientX - bounds.left) / bounds.width) * Math.max(320, Math.round(bounds.width));
    const relative = Math.min(1, Math.max(0, (canvasX - layout.left) / layout.width));
    const index = layout.type === "line"
      ? Math.round(relative * (layout.count - 1))
      : Math.min(layout.count - 1, Math.floor(relative * layout.count));
    stopPlayback();
    selectItem(index);
  };

  chartCanvas.addEventListener("click", selectCanvasCategory);
  chartCanvas.addEventListener("keydown", (event) => {
    const itemCount = views[activeViewIndex]?.items?.length || 0;
    if (!itemCount) return;
    const keyTargets = {
      ArrowRight: (activeItemIndex + 1) % itemCount,
      ArrowDown: (activeItemIndex + 1) % itemCount,
      ArrowLeft: (activeItemIndex - 1 + itemCount) % itemCount,
      ArrowUp: (activeItemIndex - 1 + itemCount) % itemCount,
      Home: 0,
      End: itemCount - 1,
    };
    if (!(event.key in keyTargets)) return;
    event.preventDefault();
    stopPlayback();
    selectItem(keyTargets[event.key]);
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => renderChart(1)).observe(chartCanvas);
  } else {
    window.addEventListener("resize", () => renderChart(1));
  }
  let resumeAfterVisibility = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resumeAfterVisibility = Boolean(playTimer);
      stopPlayback();
    } else if (resumeAfterVisibility && !reducedMotion.matches) {
      resumeAfterVisibility = false;
      startPlayback();
    }
  });
  selectView(0);
}

function setupMediaFilters() {
  document.querySelectorAll("[data-media-filter]").forEach((toolbar) => {
    const grid = document.getElementById(toolbar.dataset.gridId);
    if (!grid) return;
    const cards = [...grid.querySelectorAll("[data-media-group]")];
    const buttons = [...toolbar.querySelectorAll("[data-filter-value]")];

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.filterValue;
        buttons.forEach((candidate) => {
          const isActive = candidate === button;
          candidate.classList.toggle("is-active", isActive);
          candidate.setAttribute("aria-pressed", String(isActive));
        });
        cards.forEach((card) => {
          const shouldShow = value === "all" || card.dataset.mediaGroup === value;
          card.hidden = !shouldShow;
          const video = card.querySelector("video");
          if (!shouldShow) {
            video?.pause();
          } else if (video) {
            const bounds = video.getBoundingClientRect();
            if (bounds.bottom > 0 && bounds.top < window.innerHeight) video.play().catch(() => {});
          }
        });
      });
    });
  });
}

function setupVideoPlayback() {
  const videos = [...document.querySelectorAll("video")];
  const playVideo = (video) => {
    if (!video.closest("[hidden]")) video.play().catch(() => {});
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.15 && !video.closest("[hidden]")) playVideo(video);
          else video.pause();
        });
      },
      {threshold: [0, 0.15, 0.5]},
    );
    videos.forEach((video) => observer.observe(video));
  } else {
    videos.forEach(playVideo);
  }

  document.addEventListener("visibilitychange", () => {
    videos.forEach((video) => {
      if (document.hidden) {
        video.pause();
        return;
      }
      const bounds = video.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < window.innerHeight) playVideo(video);
    });
  });
}

function setupReadingProgress() {
  const indicator = document.querySelector(".reading-progress span");
  if (!indicator) return;
  let frameRequested = false;
  const update = () => {
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollRange > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollRange)) : 0;
    indicator.style.transform = `scaleX(${progress})`;
    frameRequested = false;
  };
  const requestUpdate = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener("scroll", requestUpdate, {passive: true});
  window.addEventListener("resize", requestUpdate);
  update();
}

function setupSectionNavigation() {
  const links = [...document.querySelectorAll(".site-nav a[href^='#']")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (!("IntersectionObserver" in window) || !sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${visible.target.id}`;
        link.classList.toggle("is-active", isActive);
        if (isActive) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    },
    {rootMargin: "-18% 0px -66%", threshold: [0, 0.15, 0.45]},
  );
  sections.forEach((section) => observer.observe(section));
}

function renderExtendedContent(paper, site, media) {
  document.querySelector("#extended-content").innerHTML = [
    renderMethod(paper, media),
    renderRealWorldWithMedia(paper, media),
    renderSimulation(paper, media),
    renderAblations(paper),
    renderCases(paper, media),
    renderCitation(paper, site),
  ].join("");
  setupMethodExplorer(paper.method);
  setupAblationExplorer(paper.ablations);
  setupMediaFilters();
  setupVideoPlayback();
  setupSectionNavigation();
}

async function initialize() {
  try {
    const responses = await Promise.all(Object.values(PATHS).map((path) => fetch(path)));
    if (responses.some((response) => !response.ok)) throw new Error("Project data could not be loaded.");
    const [paper, site, media] = await Promise.all(responses.map((response) => response.json()));
    renderHero(paper, site, media);
    renderExtendedContent(paper, site, media);
    setupReadingProgress();
  } catch (error) {
    document.querySelector("#paper-title").textContent = "CMAP";
    document.querySelector("#extended-content").innerHTML = `<p class="load-error">${escapeHtml(error.message)} Serve this directory with a local web server.</p>`;
  }
}

initialize();
