/* ATLAS: нормализация факультетов / кафедр / команд студентов */
(function () {
  const updates = {
    "hudson-hummond": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра хоккея",
      team: "Castelmara Hawks",
      mode: "team"
    },

    "melody-stoker": {
      faculty: "факультет спортивной медицины и реабилитации",
      department: "кафедра физиотерапии и реабилитации",
      mode: "department"
    },

    "manuel-moretti": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра футбола",
      team: "Castelmara Foxes",
      mode: "team"
    },

    "dolly-eigner": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра водных видов спорта",
      mode: "department"
    },

    "oliver-brown": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра футбола",
      team: "«castelmara foxes»",
      mode: "team"
    },

    "ramona-martina-suarez": {
      faculty: "факультет спортивной аналитики, управления, права и агентской деятельности",
      department: "кафедра спортивного права и агентской деятельности",
      specialization: "капитан группы поддержки",
      team: "«castelmara foxes»",
      mode: "cheer"
    },

    "evelina-de-la-rosa": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра лёгкой атлетики",
      specialization: "спринт",
      team: "группа поддержки «castelmara foxes»",
      mode: "cheer"
    },

    "alexa-soriano": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра гимнастики и акробатики",
      specialization: "художественная гимнастика",
      team: "группа поддержки «castelmara foxes»",
      mode: "cheer"
    },

    "blaise-lancer": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра хоккея",
      team: "«castelmara guards»",
      mode: "team"
    },

    "pablo-de-longa": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра хоккея",
      team: "«castelmara guards»",
      mode: "team"
    },

    "david-capurro": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра футбола",
      team: "«castelmara foxes»",
      mode: "team"
    },

    "na-ri-khwan": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра водных видов спорта",
      mode: "department"
    },

    "cedric-joy": {
      faculty: "факультет спортивной аналитики, управления, права и агентской деятельности",
      department: "кафедра спортивного права и агентской деятельности",
      mode: "department"
    },

    "derya-akyn": {
      faculty: "факультет спортивной журналистики и медиа",
      department: "кафедра спортивной журналистики",
      mode: "department"
    },

    "rowan-hale": {
      faculty: "факультет спортивной медицины и реабилитации",
      department: "кафедра физиотерапии и реабилитации",
      mode: "department"
    },

    "po-imogen": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра гимнастики и акробатики",
      mode: "department"
    },

    "connor-graves": {
      faculty: "факультет спортивной аналитики, управления, права и агентской деятельности",
      department: "кафедра спортивного права и агентской деятельности",
      mode: "department"
    },

    "valeria-costa": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра лёгкой атлетики",
      mode: "department"
    },

    "enzo-mercedes": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра зимних индивидуальных видов спорта",
      mode: "department"
    },

    "vanessa-moreno": {
      faculty: "факультет спортивной аналитики, управления, права и агентской деятельности",
      department: "кафедра спортивного права и агентской деятельности",
      mode: "department"
    },

    "owen-blake": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра лёгкой атлетики",
      mode: "department"
    },

    "eleonora-crane": {
      faculty: "факультет спортивной психологии",
      department: "кафедра клинической спортивной психологии",
      mode: "department"
    },

    "kavya-nair": {
      faculty: "факультет спортивной медицины и реабилитации",
      department: "кафедра спортивной фармакологии",
      mode: "department"
    }
  };

  const characters = Array.isArray(window.ATLAS_CHARACTERS)
    ? window.ATLAS_CHARACTERS
    : [];

  characters.forEach(function (character) {
    const update = character && updates[character.id];
    if (!update) return;

    const info =
      character.profile &&
      character.profile.overview &&
      character.profile.overview.mainInfo;

    if (!info) return;

    info.faculty = update.faculty;
    info.department = update.department;

    /* игровые виды спорта:
       факультет + кафедра + команда */
    if (update.mode === "team") {
      info.team = update.team;
      delete info.specialization;
    }

    /* остальные:
       факультет + кафедра */
    if (update.mode === "department") {
      delete info.team;
      delete info.specialization;
    }

    /* группа поддержки:
       факультет + кафедра + специализация + команда */
    if (update.mode === "cheer") {
      info.specialization = update.specialization;
      info.team = update.team;
    }
  });

  if (typeof window.atlasRenderCharacters === "function") {
    window.atlasRenderCharacters();
  }

  window.dispatchEvent(
    new CustomEvent("atlasCharactersReady", {
      detail: {
        characters: characters,
        source: "students-faculty-normalization"
      }
    })
  );
})();

/* ATLAS: нормализация факультетов / кафедр / команд студентов */
(function () {
  const updates = {
    "hudson-hummond": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра хоккея",
      team: "Castelmara Hawks",
      mode: "team"
    },

    "melody-stoker": {
      faculty: "факультет спортивной медицины и реабилитации",
      department: "кафедра физиотерапии и реабилитации",
      mode: "department"
    },

    "manuel-moretti": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра футбола",
      team: "Castelmara Foxes",
      mode: "team"
    },

    "dolly-eigner": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра водных видов спорта",
      mode: "department"
    },

    "oliver-brown": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра футбола",
      team: "«castelmara foxes»",
      mode: "team"
    },

    "ramona-martina-suarez": {
      faculty: "факультет спортивной аналитики, управления, права и агентской деятельности",
      department: "кафедра спортивного права и агентской деятельности",
      specialization: "капитан группы поддержки",
      team: "«castelmara foxes»",
      mode: "cheer"
    },

    "evelina-de-la-rosa": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра лёгкой атлетики",
      specialization: "спринт",
      team: "группа поддержки «castelmara foxes»",
      mode: "cheer"
    },

    "alexa-soriano": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра гимнастики и акробатики",
      specialization: "художественная гимнастика",
      team: "группа поддержки «castelmara foxes»",
      mode: "cheer"
    },

    "blaise-lancer": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра хоккея",
      team: "«castelmara guards»",
      mode: "team"
    },

    "pablo-de-longa": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра хоккея",
      team: "«castelmara guards»",
      mode: "team"
    },

    "david-capurro": {
      faculty: "факультет тактики и игровых видов спорта",
      department: "кафедра футбола",
      team: "«castelmara foxes»",
      mode: "team"
    },

    "na-ri-khwan": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра водных видов спорта",
      mode: "department"
    },

    "cedric-joy": {
      faculty: "факультет спортивной аналитики, управления, права и агентской деятельности",
      department: "кафедра спортивного права и агентской деятельности",
      mode: "department"
    },

    "derya-akyn": {
      faculty: "факультет спортивной журналистики и медиа",
      department: "кафедра спортивной журналистики",
      mode: "department"
    },

    "rowan-hale": {
      faculty: "факультет спортивной медицины и реабилитации",
      department: "кафедра физиотерапии и реабилитации",
      mode: "department"
    },

    "po-imogen": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра гимнастики и акробатики",
      mode: "department"
    },

    "connor-graves": {
      faculty: "факультет спортивной аналитики, управления, права и агентской деятельности",
      department: "кафедра спортивного права и агентской деятельности",
      mode: "department"
    },

    "valeria-costa": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра лёгкой атлетики",
      mode: "department"
    },

    "enzo-mercedes": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра зимних индивидуальных видов спорта",
      mode: "department"
    },

    "vanessa-moreno": {
      faculty: "факультет спортивной аналитики, управления, права и агентской деятельности",
      department: "кафедра спортивного права и агентской деятельности",
      mode: "department"
    },

    "owen-blake": {
      faculty: "факультет индивидуальных видов спорта",
      department: "кафедра лёгкой атлетики",
      mode: "department"
    },

    "eleonora-crane": {
      faculty: "факультет спортивной психологии",
      department: "кафедра клинической спортивной психологии",
      mode: "department"
    },

    "kavya-nair": {
      faculty: "факультет спортивной медицины и реабилитации",
      department: "кафедра спортивной фармакологии",
      mode: "department"
    }
  };

  const characters = Array.isArray(window.ATLAS_CHARACTERS)
    ? window.ATLAS_CHARACTERS
    : [];

  characters.forEach(function (character) {
    const update = character && updates[character.id];
    if (!update) return;

    const info =
      character.profile &&
      character.profile.overview &&
      character.profile.overview.mainInfo;

    if (!info) return;

    info.faculty = update.faculty;
    info.department = update.department;

    /* игровые виды спорта:
       факультет + кафедра + команда */
    if (update.mode === "team") {
      info.team = update.team;
      delete info.specialization;
    }

    /* остальные:
       факультет + кафедра */
    if (update.mode === "department") {
      delete info.team;
      delete info.specialization;
    }

    /* группа поддержки:
       факультет + кафедра + специализация + команда */
    if (update.mode === "cheer") {
      info.specialization = update.specialization;
      info.team = update.team;
    }
  });

  if (typeof window.atlasRenderCharacters === "function") {
    window.atlasRenderCharacters();
  }

  window.dispatchEvent(
    new CustomEvent("atlasCharactersReady", {
      detail: {
        characters: characters,
        source: "students-faculty-normalization"
      }
    })
  );
})();
