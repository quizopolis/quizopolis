/* Example games for the English version: every question type, English grammar, maths, science and geography. */
import { rid } from './ui.js';
import { PLANT_IMG } from './sample-art.js';

const Q = (type, time, data) => Object.assign({ id: 'q' + rid(8), type, text: '', image: '', time, double: false, explain: '' }, data);

export function sampleGamesEn() {
  return [
    {
      title: 'Getting started: every question type',
      mode: 'classic',
      description: 'A short game with one question of each type, so you can see what children see.',
      grades: ['Ε΄', 'Στ΄'], subject: 'Γενικές γνώσεις', cover: { color: '#0B7A5C', emoji: '🧩' },
      questions: [
        Q('mcq', 20, { category: 'Maths', text: 'What is 3/4 + 1/4?', options: ['1', '4/8', '3/16', '2'], correct: 0, explain: '3/4 + 1/4 = 4/4, which is 1 whole.' }),
        Q('multi', 30, { category: 'English', text: 'Which of these words are verbs?', options: ['run', 'quick', 'reads', 'house', 'wrote'], correct: [0, 2, 4] }),
        Q('tf', 20, { category: 'Science', text: 'Sound travels faster than light.', correct: false, explain: 'Light travels about 300,000 kilometres a second; sound in air only about 340 metres.', double: true }),
        Q('fill', 30, { category: 'Maths', text: 'What is 0.5 × 8?', answers: ['4'] }),
        Q('dropdown', 45, { category: 'English', text: 'Choose the right form of the verb for each gap.', cloze: 'Yesterday I [wrote|write|will write] a letter to my grandma, and tomorrow I [will post|posted|post] it.' }),
        Q('drag', 45, { category: 'History', text: 'Drag each year into the right gap.', cloze: 'People first walked on the Moon in [1969]. The first modern Olympic Games were held in Athens in [1896].', extra: ['1914', '1945'] }),
        Q('label', 120, { category: 'Science', text: 'Drag each word to the right part of the plant.', image: PLANT_IMG, labels: [{ id: 'l0', text: 'flower', x: 0.766, y: 0.173 }, { id: 'l1', text: 'leaf', x: 0.141, y: 0.568 }, { id: 'l2', text: 'stem', x: 0.766, y: 0.65 }, { id: 'l3', text: 'root', x: 0.766, y: 0.9 }], extra: ['fruit'] }),
        Q('underline', 45, { category: 'History', text: 'Underline in the text when the Parthenon was built.', passage: 'The Parthenon is a temple of the goddess Athena on the Acropolis of Athens. It was built in the [5th century BC], in the age of Pericles.' }),
        Q('match', 60, { category: 'Geography', text: 'Match each city with its country.', pairs: [{ a: 'Paris', b: 'France' }, { a: 'Madrid', b: 'Spain' }, { a: 'Lisbon', b: 'Portugal' }, { a: 'Dublin', b: 'Ireland' }] }),
        Q('reorder', 60, { category: 'Maths', text: 'Put the numbers in order, from smallest to largest.', items: ['0.09', '0.4', '1.5', '2'] }),
        Q('categorize', 60, { category: 'English', text: 'Put each word in the right group.', groups: [{ name: 'Nouns', items: ['sea', 'teacher', 'book'] }, { name: 'Adjectives', items: ['tall', 'pretty', 'red'] }, { name: 'Verbs', items: ['swim', 'jump'] }] }),
        Q('poll', 20, { text: 'Which subject do you like most?', options: ['Maths', 'English', 'History', 'Science'] }),
        Q('open', 90, { text: 'Write in a few words something you learned today.' })
      ]
    },
    {
      title: 'English: past simple',
      mode: 'millionaire',
      description: 'Regular and irregular verbs in the past simple, questions and negatives.',
      grades: ['Δ΄', 'Ε΄', 'Στ΄'], subject: 'Αγγλικά', cover: { color: '#8E44D9', emoji: '✏️' },
      questions: [
        Q('mcq', 20, { category: 'Irregular verbs', text: 'What is the past simple of “go”?', options: ['went', 'goed', 'gone', 'goes'], correct: 0 }),
        Q('tf', 20, { category: 'Regular verbs', text: '“Played” is the past simple of “play”.', correct: true }),
        Q('fill', 30, { category: 'Irregular verbs', text: 'Write the past simple of “eat”.', answers: ['ate'] }),
        Q('dropdown', 45, { category: 'Questions and negatives', text: 'Choose the right word for each gap.', cloze: '[Did|Does|Was] you see the film last night? No, I [didn\'t|don\'t|wasn\'t] see it.' }),
        Q('categorize', 60, { category: 'Regular verbs', text: 'Regular or irregular?', groups: [{ name: 'Regular', items: ['walked', 'played', 'visited'] }, { name: 'Irregular', items: ['swam', 'took', 'bought'] }] }),
        Q('underline', 45, { category: 'Irregular verbs', text: 'Underline the verbs in the past simple.', passage: 'Last summer we [went] to the beach. My brother [swam] every day, but I usually read a book under the umbrella. One evening we [ate] pizza by the sea.' }),
        Q('match', 60, { category: 'Irregular verbs', text: 'Match each verb with its past simple.', pairs: [{ a: 'see', b: 'saw' }, { a: 'make', b: 'made' }, { a: 'run', b: 'ran' }, { a: 'buy', b: 'bought' }] })
      ]
    },
    {
      title: 'Maths: fractions and decimals',
      mode: 'penalty',
      description: 'Equivalent fractions, comparing numbers and adding decimals.',
      grades: ['Ε΄', 'Στ΄'], subject: 'Μαθηματικά', cover: { color: '#2F6FE4', emoji: '➗' },
      questions: [
        Q('mcq', 20, { category: 'Fractions', text: 'Which fraction is equal to 0.25?', options: ['1/4', '2/5', '1/25', '25/10'], correct: 0 }),
        Q('fill', 45, { category: 'Decimals', text: 'What is 2.5 + 1.75?', answers: ['4.25', '4,25'] }),
        Q('reorder', 60, { category: 'Comparing', text: 'Put the numbers in order, from smallest to largest.', items: ['0.3', '1/2', '0.75', '1.2'] }),
        Q('multi', 30, { category: 'Fractions', text: 'Which fractions are equal to 1/2?', options: ['2/4', '3/6', '2/3', '5/10'], correct: [0, 1, 3] }),
        Q('tf', 20, { category: 'Decimals', text: '0.5 is greater than 0.45.', correct: true, explain: '0.5 = 0.50, and 50 hundredths are more than 45 hundredths.' }),
        Q('categorize', 60, { category: 'Comparing', text: 'Smaller or larger than 1?', groups: [{ name: 'Smaller than 1', items: ['3/4', '0.9', '1/3'] }, { name: 'Larger than 1', items: ['5/4', '1.1', '7/3'] }] })
      ]
    },
    {
      title: 'Science: water, sound and electricity',
      mode: 'race',
      description: 'States of water, conductors and insulators, sound and the planets.',
      grades: ['Ε΄', 'Στ΄'], subject: 'Φυσικά', cover: { color: '#0FA3B1', emoji: '🔬' },
      questions: [
        Q('mcq', 20, { category: 'Water', text: 'At what temperature does water boil at sea level?', options: ['100 °C', '0 °C', '50 °C', '212 °C'], correct: 0 }),
        Q('categorize', 60, { category: 'Electricity', text: 'Conductors or insulators?', groups: [{ name: 'Conductors', items: ['copper', 'iron', 'aluminium'] }, { name: 'Insulators', items: ['plastic', 'wood', 'glass'] }] }),
        Q('tf', 20, { category: 'Sound and light', text: 'Sound can travel through empty space.', correct: false, explain: 'Sound needs a material, like air or water, to travel through.' }),
        Q('drag', 45, { category: 'Water', text: 'Drag each word into the right gap.', cloze: 'When ice gets warm it [melts]. When water gets very hot it [boils].', extra: ['freezes'] }),
        Q('underline', 45, { category: 'Water', text: 'Underline the three states in which we find water.', passage: 'In nature, water is found as a [solid] in the ice of the mountains, as a [liquid] in seas and rivers and as a [gas] in the water vapour in the air.' }),
        Q('reorder', 60, { category: 'Space', text: 'Put the planets in order of distance from the Sun.', items: ['Mercury', 'Venus', 'Earth', 'Mars'] })
      ]
    },
    {
      title: 'Geography: around the world',
      mode: 'jeopardy',
      description: 'Continents, oceans, capitals and famous landmarks.',
      grades: ['Ε΄', 'Στ΄'], subject: 'Γεωγραφία', cover: { color: '#C2410C', emoji: '🌍' },
      questions: [
        Q('mcq', 20, { category: 'Continents', text: 'Which is the largest continent?', options: ['Asia', 'Africa', 'Europe', 'Australia'], correct: 0 }),
        Q('match', 60, { category: 'Capitals', text: 'Match each country with its capital.', pairs: [{ a: 'Greece', b: 'Athens' }, { a: 'Italy', b: 'Rome' }, { a: 'Egypt', b: 'Cairo' }, { a: 'Japan', b: 'Tokyo' }] }),
        Q('tf', 20, { category: 'Oceans', text: 'The Pacific is the largest ocean.', correct: true }),
        Q('fill', 30, { category: 'Capitals', text: 'What is the capital of the United Kingdom?', answers: ['London'] }),
        Q('underline', 45, { category: 'Landmarks', text: 'Underline the country where the Eiffel Tower is.', passage: 'The Eiffel Tower was built in 1889 in Paris, the capital of [France]. It is one of the most visited monuments in Europe.' }),
        Q('multi', 30, { category: 'Continents', text: 'Which of these countries are in Europe?', options: ['Spain', 'Brazil', 'Poland', 'Kenya'], correct: [0, 2] }),
        Q('mcq', 20, { category: 'Landmarks', text: 'In which country are the pyramids of Giza?', options: ['Egypt', 'Mexico', 'Peru', 'India'], correct: 0 })
      ]
    }
  ];
}
