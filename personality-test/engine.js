(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./questions.js'));
  else root.AtlasPersonalityEngine = factory(root.AtlasPersonalityQuestions);
})(typeof window !== 'undefined' ? window : globalThis, function(bank) {
  'use strict';
  const ORDER = Object.freeze(['captain','wildcard','anchor','prodigy','ghost','spark']);
  const CORE = Object.freeze({anchor:1,captain:5,prodigy:9,ghost:13,spark:17,wildcard:21});
  const empty = () => Object.fromEntries(ORDER.map(type => [type,0]));

  function resolveScores(scores, coreScores, primaryHits) {
    for (const values of [scores,coreScores,primaryHits]) {
      if (!values || ORDER.some(type => !Number.isInteger(values[type]) || values[type] < 0)) throw new Error('Invalid score vector');
    }
    const ranked = ORDER.slice().sort((a,b) => scores[b]-scores[a] || coreScores[b]-coreScores[a] || primaryHits[b]-primaryHits[a] || ORDER.indexOf(a)-ORDER.indexOf(b));
    const [first,second,third] = ranked;
    if (!scores[first]) throw new Error('No answers');
    const hasSecondary = scores[second]*10 >= scores[first]*7 && scores[second]-scores[third] >= 2 && scores[second] !== scores[third];
    const dominance = scores[first]-scores[second];
    return {
      test_version:bank.version,
      primary_type:first, secondary_type:hasSecondary ? second : null, has_secondary:hasSecondary,
      dominance, dominance_category:dominance <= 2 ? 'mixed' : dominance <= 6 ? 'balanced' : 'dominant',
      scores:{...scores}, core_scores:{...coreScores}, primary_hits:{...primaryHits}
    };
  }

  function validateAnswers(answers, complete = true) {
    if (!Array.isArray(answers) || answers.length !== bank.questions.length) return false;
    for (let i=0;i<bank.questions.length;i++) {
      if (!complete && answers[i] === null) continue;
      if (!bank.questions[i].answers.some(answer => answer.id === answers[i])) return false;
    }
    return true;
  }

  function scoreAnswers(answers) {
    if (!validateAnswers(answers)) throw new Error('All 24 questions require one valid answer');
    const scores=empty(), primaryHits=empty(), coreScores=empty();
    bank.questions.forEach((question,index) => {
      const answer=question.answers.find(option => option.id === answers[index]);
      scores[answer.primary_type] += answer.primary_weight;
      scores[answer.secondary_type] += answer.secondary_weight;
      primaryHits[answer.primary_type]++;
      for (const type of ORDER) if (CORE[type] === index+1) {
        coreScores[type] = answer.primary_type === type ? answer.primary_weight : answer.secondary_type === type ? answer.secondary_weight : 0;
      }
    });
    return resolveScores(scores,coreScores,primaryHits);
  }
  return Object.freeze({version:bank.version,ORDER,CORE,validateAnswers,scoreAnswers,resolveScores});
});
