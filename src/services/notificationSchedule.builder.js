/**
 * Builds the multi-device notification schedule from DB records.
 * Mirrors frontend reminder-rules (+ activity −30 min warning).
 */

const DAY_OFFSETS_BY_PRIORITY = {
  high: [7, 3, 1, 0],
  medium: [3, 1, 0],
  low: [1, 0],
};

const IMPLICIT_DAY_HOURS = new Set([0, 5, 9]);
const SOFT_DAY_HOUR = 5;
const DAY_CHECKIN_HOURS = [5, 12, 18];
const CHECKIN_LOOKAHEAD_DAYS = 7;
const ACTIVITY_SOON_MINUTES = 30;

const EXACT_ALERT_ID_PREFIX = "kivo-exact-";
const OFFSET_ALERT_ID_PREFIX = "asistente-reminder-";
const CHECKIN_ALERT_ID_PREFIX = "kivo-checkin-";
const ACTIVITY_SOON_ID_PREFIX = "kivo-activity-30m-";
const DAILY_SUMMARY_ID = "kivo-summary-daily";

function isCompleted(record) {
  const status = record?.data?.status;
  return status === "completed";
}

function isSchedulable(record) {
  if (isCompleted(record)) return false;
  return record.type === "task" || record.type === "reminder" || record.type === "meeting";
}

function hasExplicitClockTime(dateValue) {
  if (!dateValue) return false;
  const raw = typeof dateValue === "string" ? dateValue : new Date(dateValue).toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return false;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.getUTCMinutes() !== 0 || parsed.getUTCSeconds() !== 0) return true;
  // Prefer local wall-clock via the stored instant in the server default TZ by
  // using the Date's local getters in the worker process TZ, or hours from ISO.
  const hours = parsed.getHours();
  const minutes = parsed.getMinutes();
  const seconds = parsed.getSeconds();
  if (minutes !== 0 || seconds !== 0) return true;
  if (IMPLICIT_DAY_HOURS.has(hours)) return false;
  return true;
}

function isCriticalRecord(record) {
  return (record.priority || "medium") === "high";
}

function resolveKind(record, alertLevel) {
  if (alertLevel === "alarm" || isCriticalRecord(record)) return "critical";
  return "reminder";
}

function softDayLocal(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    SOFT_DAY_HOUR,
    0,
    0,
    0
  );
}

function subtractDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function formatTimeLabel(date) {
  return date.toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" });
}

function dayMessage(title, daysBefore) {
  if (daysBefore === 7) return `Faltan 7 días: ${title}`;
  if (daysBefore === 3) return `Faltan 3 días: ${title}`;
  if (daysBefore === 1) return `Mañana: ${title}`;
  return `Hoy: ${title}`;
}

function parseDueDate(record) {
  if (!record.date) return null;
  const parsed = new Date(record.date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isOpenEnded(record) {
  return isSchedulable(record) && !record.date;
}

function pushItem(items, item) {
  if (!item) return;
  if (item.triggerAt.getTime() <= Date.now()) return;
  items.push(item);
}

function buildOffsetReminders(record, dueDate, skipTodayOffset) {
  const items = [];
  const priority = record.priority || "medium";
  const dayOffsets = DAY_OFFSETS_BY_PRIORITY[priority] || DAY_OFFSETS_BY_PRIORITY.medium;
  const title = record.title || "Sin título";
  const now = Date.now();

  for (const daysBefore of dayOffsets) {
    if (skipTodayOffset && daysBefore === 0) continue;
    const triggerAt = subtractDays(softDayLocal(dueDate), daysBefore);
    if (triggerAt.getTime() <= now) continue;

    const alertLevel =
      daysBefore === 0 && isCriticalRecord(record) ? "alarm" : "notification";
    const kind = resolveKind(record, alertLevel);

    items.push({
      scheduleKey: `${OFFSET_ALERT_ID_PREFIX}${record.id}-d${daysBefore}`,
      recordId: record.id,
      triggerAt,
      title: kind === "critical" ? "Alerta crítica" : "Kivo",
      body: dayMessage(title, daysBefore),
      alertLevel,
      kind,
    });
  }

  if (hasExplicitClockTime(record.date) && priority !== "low") {
    const oneHourBefore = new Date(dueDate.getTime() - 60 * 60 * 1000);
    if (oneHourBefore.getTime() > now) {
      const alertLevel = isCriticalRecord(record) ? "alarm" : "notification";
      const kind = resolveKind(record, alertLevel);
      items.push({
        scheduleKey: `${OFFSET_ALERT_ID_PREFIX}${record.id}-h1`,
        recordId: record.id,
        triggerAt: oneHourBefore,
        title: kind === "critical" ? "Alerta crítica" : "Kivo",
        body: `En 1 hora: ${title}`,
        alertLevel,
        kind,
      });
    }
  }

  return items;
}

function buildActivitySoonReminder(record, exactDue) {
  if (!hasExplicitClockTime(record.date)) return null;
  const triggerAt = new Date(exactDue.getTime() - ACTIVITY_SOON_MINUTES * 60 * 1000);
  const name = (record.title || "Sin título").trim() || "Sin título";
  const quoted = `«${name}»`;

  let title = "Actividad en 30 minutos";
  let body = `Tu actividad ${quoted} es en 30 minutos`;

  if (record.type === "meeting") {
    title = "Reunión en 30 minutos";
    body = `Tu reunión ${quoted} empieza en 30 minutos`;
  } else if (record.type === "reminder") {
    title = "Recordatorio en 30 minutos";
    body = `Tu recordatorio ${quoted} es en 30 minutos`;
  } else if (record.type === "task") {
    title = "Tarea en 30 minutos";
    body = `Tu tarea ${quoted} es en 30 minutos`;
  }

  return {
    scheduleKey: `${ACTIVITY_SOON_ID_PREFIX}${record.id}`,
    recordId: record.id,
    triggerAt,
    title,
    body,
    alertLevel: "notification",
    kind: "activity-warning",
    payload: {
      openWakeAlert: "1",
      activityTitle: name,
      activityType: record.type || "task",
      minutesBefore: ACTIVITY_SOON_MINUTES,
    },
  };
}

function buildExactTimeReminder(record, exactDue) {
  const name = (record.title || "Sin título").trim() || "Sin título";
  const timeLabel = formatTimeLabel(exactDue);

  let title = "Es la hora de tu actividad";
  if (record.type === "meeting") title = "Es la hora de tu reunión";
  else if (record.type === "reminder") title = "Es la hora de tu recordatorio";
  else if (record.type === "task") title = "Es la hora de tu tarea";

  return {
    scheduleKey: `${EXACT_ALERT_ID_PREFIX}${record.id}`,
    recordId: record.id,
    triggerAt: exactDue,
    title,
    body: `${name} · ${timeLabel}`,
    alertLevel: "alarm",
    kind: "critical",
    payload: {
      openCriticalAlarm: "1",
      alarmTitle: name,
      activityType: record.type || "task",
    },
  };
}

function formatLongDayLabel(date) {
  return date.toLocaleDateString("es", { day: "numeric", month: "long" });
}

function buildDayBeforeCopy(record, dueDate) {
  const name = ((record.title || "Sin título").trim() || "Sin título");
  const quoted = `«${name}»`;
  const when = formatLongDayLabel(dueDate);

  if (record.type === "meeting") {
    return {
      title: "Reunión mañana",
      body: `Mañana, ${when}, tienes la reunión ${quoted}`,
    };
  }
  if (record.type === "reminder") {
    return {
      title: "Recordatorio mañana",
      body: `Mañana, ${when}, tienes el recordatorio ${quoted}`,
    };
  }
  if (record.type === "task") {
    return {
      title: "Tarea mañana",
      body: `Mañana, ${when}, tienes la tarea ${quoted}`,
    };
  }
  return {
    title: "Actividad mañana",
    body: `Mañana, ${when}, tienes la actividad ${quoted}`,
  };
}

function buildDayOfCopy(record) {
  const name = ((record.title || "Sin título").trim() || "Sin título");
  const quoted = `«${name}»`;

  if (record.type === "meeting") {
    return { title: "Reunión hoy", body: `Hoy tienes la reunión ${quoted}` };
  }
  if (record.type === "reminder") {
    return { title: "Recordatorio hoy", body: `Hoy tienes el recordatorio ${quoted}` };
  }
  if (record.type === "task") {
    return { title: "Tarea hoy", body: `Hoy tienes la tarea ${quoted}` };
  }
  return { title: "Actividad hoy", body: `Hoy tienes la actividad ${quoted}` };
}

function buildDayCheckInCopy(record, hour) {
  const name = ((record.title || "Sin título").trim() || "Sin título");
  const quoted = `«${name}»`;

  if (hour === 5) {
    return buildDayOfCopy(record);
  }

  if (hour === 12) {
    if (record.type === "meeting") {
      return {
        title: "Reunión pendiente",
        body: `A mediodía sigue pendiente tu reunión ${quoted}`,
      };
    }
    if (record.type === "reminder") {
      return {
        title: "Recordatorio pendiente",
        body: `A mediodía sigue pendiente tu recordatorio ${quoted}`,
      };
    }
    if (record.type === "task") {
      return {
        title: "Tarea pendiente",
        body: `A mediodía sigue pendiente tu tarea ${quoted}`,
      };
    }
    return {
      title: "Actividad pendiente",
      body: `A mediodía sigue pendiente tu actividad ${quoted}`,
    };
  }

  if (record.type === "meeting") {
    return {
      title: "Reunión de hoy",
      body: `Esta tarde aún tienes la reunión ${quoted}`,
    };
  }
  if (record.type === "reminder") {
    return {
      title: "Recordatorio de hoy",
      body: `Esta tarde aún tienes el recordatorio ${quoted}`,
    };
  }
  if (record.type === "task") {
    return {
      title: "Tarea de hoy",
      body: `Esta tarde aún tienes la tarea ${quoted}`,
    };
  }
  return {
    title: "Actividad de hoy",
    body: `Esta tarde aún tienes la actividad ${quoted}`,
  };
}

function resolveSoftDayTrigger(preferredAt, now) {
  if (preferredAt.getTime() > now) return preferredAt;

  const dayStart = new Date(
    preferredAt.getFullYear(),
    preferredAt.getMonth(),
    preferredAt.getDate()
  );
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  if (now >= dayStart.getTime() && now < dayEnd.getTime()) {
    return new Date(now + 20_000);
  }

  return null;
}

/** Day-only: day before + due-day check-ins at 12 / 18 (5:00 = briefing). */
function buildDayOnlyActivityReminders(record, dueDate) {
  const items = [];
  const dueDayStart = softDayLocal(dueDate);
  const now = Date.now();

  const dayBeforeAt = resolveSoftDayTrigger(subtractDays(dueDayStart, 1), now);
  if (dayBeforeAt) {
    const copy = buildDayBeforeCopy(record, dueDate);
    items.push({
      scheduleKey: `${OFFSET_ALERT_ID_PREFIX}${record.id}-d1`,
      recordId: record.id,
      triggerAt: dayBeforeAt,
      title: copy.title,
      body: copy.body,
      alertLevel: "notification",
      kind: "reminder",
    });
  }

  for (const hour of DAY_CHECKIN_HOURS) {
    if (hour === SOFT_DAY_HOUR) continue;

    const preferred = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate(),
      hour,
      0,
      0,
      0
    );
    if (preferred.getTime() <= now) continue;

    const copy = buildDayCheckInCopy(record, hour);
    items.push({
      scheduleKey: `${CHECKIN_ALERT_ID_PREFIX}${record.id}-${preferred.getTime()}`,
      recordId: record.id,
      triggerAt: preferred,
      title: copy.title,
      body: copy.body,
      alertLevel: "notification",
      kind: "reminder",
    });
  }

  return items;
}

function buildOpenEndedCheckInCopy(record, hour) {
  const name = ((record.title || "Sin título").trim() || "Sin título");
  const quoted = `«${name}»`;

  if (hour === 5) {
    if (record.type === "meeting") {
      return {
        title: "Hey, reunión pendiente",
        body: `Hey, tu reunión ${quoted} sigue pendiente. ¿Le pones un día?`,
      };
    }
    if (record.type === "reminder") {
      return {
        title: "Hey, recordatorio pendiente",
        body: `Hey, tu recordatorio ${quoted} sigue pendiente. ¿Lo agendamos?`,
      };
    }
    if (record.type === "task") {
      return {
        title: "Hey, tarea pendiente",
        body: `Hey, tu tarea ${quoted} sigue pendiente. ¿La avanzamos hoy?`,
      };
    }
    return {
      title: "Hey, actividad pendiente",
      body: `Hey, tu actividad ${quoted} sigue pendiente. ¿Le pones un día?`,
    };
  }

  if (hour === 12) {
    if (record.type === "meeting") {
      return {
        title: "Hey, mediodía",
        body: `Hey, a mediodía: tu reunión ${quoted} sigue sin fecha`,
      };
    }
    if (record.type === "reminder") {
      return {
        title: "Hey, mediodía",
        body: `Hey, a mediodía: tu recordatorio ${quoted} sigue pendiente`,
      };
    }
    if (record.type === "task") {
      return {
        title: "Hey, mediodía",
        body: `Hey, a mediodía: tu tarea ${quoted} sigue pendiente`,
      };
    }
    return {
      title: "Hey, mediodía",
      body: `Hey, a mediodía: tu actividad ${quoted} sigue pendiente`,
    };
  }

  if (record.type === "meeting") {
    return {
      title: "Hey, no lo olvides",
      body: `Hey, antes de cerrar el día: tu reunión ${quoted} sigue pendiente`,
    };
  }
  if (record.type === "reminder") {
    return {
      title: "Hey, no lo olvides",
      body: `Hey, antes de cerrar el día: tu recordatorio ${quoted} sigue pendiente`,
    };
  }
  if (record.type === "task") {
    return {
      title: "Hey, no lo olvides",
      body: `Hey, antes de cerrar el día: tu tarea ${quoted} sigue pendiente`,
    };
  }
  return {
    title: "Hey, no lo olvides",
    body: `Hey, antes de cerrar el día: tu actividad ${quoted} sigue pendiente`,
  };
}

function buildOpenEndedActivityReminders(record, nowMs) {
  const items = [];
  const now = new Date(nowMs);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let offset = 0; offset < CHECKIN_LOOKAHEAD_DAYS; offset += 1) {
    const day = new Date(todayStart);
    day.setDate(todayStart.getDate() + offset);

    for (const hour of DAY_CHECKIN_HOURS) {
      if (hour === SOFT_DAY_HOUR) continue;

      const preferred = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        hour,
        0,
        0,
        0
      );
      if (preferred.getTime() <= nowMs) continue;

      const copy = buildOpenEndedCheckInCopy(record, hour);
      items.push({
        scheduleKey: `${CHECKIN_ALERT_ID_PREFIX}${record.id}-${preferred.getTime()}`,
        recordId: record.id,
        triggerAt: preferred,
        title: copy.title,
        body: copy.body,
        alertLevel: "notification",
        kind: "reminder",
      });
    }
  }

  return items;
}

function nextDailySummaryTrigger(from = new Date()) {
  const trigger = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
    SOFT_DAY_HOUR,
    0,
    0,
    0
  );
  if (trigger.getTime() <= from.getTime()) {
    trigger.setDate(trigger.getDate() + 1);
  }
  return trigger;
}

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function listActivitiesForBriefingDay(records, dayIso) {
  const byId = new Map();

  for (const record of records) {
    if (!isSchedulable(record)) continue;

    if (isOpenEnded(record)) {
      byId.set(record.id, record);
      continue;
    }

    if (!record.date) continue;
    const due = new Date(record.date);
    if (Number.isNaN(due.getTime())) continue;
    if (toLocalIsoDate(due) === dayIso) {
      byId.set(record.id, record);
    }
  }

  return Array.from(byId.values());
}

function formatBriefingLine(record) {
  const title = ((record.title || "Sin título").trim() || "Sin título");
  if (hasExplicitClockTime(record.date)) {
    const due = new Date(record.date);
    const time = formatTimeLabel(due);
    return time ? `${time} · ${title}` : title;
  }
  if (isOpenEnded(record)) return `${title} (sin fecha)`;
  return title;
}

function buildDailyBriefing(records, dayIso) {
  const activities = listActivitiesForBriefingDay(records, dayIso);
  const lines = activities.map(formatBriefingLine);

  if (lines.length === 0) {
    return {
      title: "Buenos días",
      body: "No tienes actividades pendientes para hoy. Buen momento para planear.",
    };
  }

  const maxListed = 5;
  const listed = lines.slice(0, maxListed);
  const remaining = lines.length - listed.length;
  let body = `Hoy (${lines.length}): ${listed.join(" · ")}`;
  if (remaining > 0) body += ` · +${remaining} más`;
  if (body.length > 350) body = `${body.slice(0, 349)}…`;

  return { title: "Actividades de hoy", body };
}

function buildDailySummary(records, now = new Date()) {
  const triggerAt = nextDailySummaryTrigger(now);
  const briefingDayIso = toLocalIsoDate(triggerAt);
  const briefing = buildDailyBriefing(records, briefingDayIso);

  return {
    scheduleKey: DAILY_SUMMARY_ID,
    recordId: null,
    triggerAt,
    title: briefing.title,
    body: briefing.body,
    alertLevel: "notification",
    kind: "daily-summary",
  };
}

function suppressDuplicateMorningAlerts(items) {
  const briefing = items.find((item) => item.kind === "daily-summary");
  if (!briefing) return items;

  const briefingDay = toLocalIsoDate(briefing.triggerAt);

  return items.filter((item) => {
    if (item.kind === "daily-summary") return true;
    const itemDay = toLocalIsoDate(item.triggerAt);
    if (itemDay !== briefingDay) return true;

    const isMorning =
      item.triggerAt.getHours() === SOFT_DAY_HOUR &&
      item.triggerAt.getMinutes() === 0;
    if (!isMorning) return true;

    const key = item.scheduleKey || "";
    if (key.startsWith(CHECKIN_ALERT_ID_PREFIX) || key.endsWith("-d0")) {
      return false;
    }
    return true;
  });
}

/**
 * @param {Array<object>} records - rows from public.records
 * @returns {Array<object>} schedule items ready for persistence
 */
function buildNotificationSchedule(records) {
  const now = Date.now();
  const items = [];
  const list = Array.isArray(records) ? records : [];

  for (const record of list) {
    if (!isSchedulable(record)) continue;

    if (isOpenEnded(record)) {
      for (const item of buildOpenEndedActivityReminders(record, now)) {
        pushItem(items, item);
      }
      continue;
    }

    const dueDate = parseDueDate(record);
    if (!dueDate) continue;

    if (hasExplicitClockTime(record.date)) {
      pushItem(items, buildExactTimeReminder(record, dueDate));
      pushItem(items, buildActivitySoonReminder(record, dueDate));
      for (const item of buildOffsetReminders(record, dueDate, true)) {
        pushItem(items, item);
      }
      continue;
    }

    // Day-only (calendar day, no clock): mañana + check-ins 5/12/18 while pending.
    for (const item of buildDayOnlyActivityReminders(record, dueDate)) {
      pushItem(items, item);
    }
  }

  pushItem(items, buildDailySummary(list, new Date(now)));

  const deduped = suppressDuplicateMorningAlerts(items);

  return deduped.map((item) => ({
    ...item,
    triggerAt: item.triggerAt.toISOString(),
    payload: {
      ...(item.payload || {}),
      scheduleKey: item.scheduleKey,
      recordId: item.recordId,
      kind: item.kind,
      alertLevel: item.alertLevel,
    },
  }));
}

module.exports = {
  buildNotificationSchedule,
  ACTIVITY_SOON_MINUTES,
  ACTIVITY_SOON_ID_PREFIX,
  EXACT_ALERT_ID_PREFIX,
};
