#!/usr/bin/env node

// Simple script to create test static quiz assets
const { writeFileSync, mkdirSync, existsSync } = require('fs')
const { join } = require('path')

// Generate a deterministic hash for cache busting
function generateAssetHash(topic, difficulty, questionCount) {
  const input = `${topic}-${difficulty}-${questionCount}-v1.0`
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// Create filename for static asset
function createAssetFilename(topic, difficulty, questionCount) {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
  
  return `${slug}-${difficulty}-${questionCount}q.json`
}

// Sample questions for testing
const sampleQuestions = {
  'javascript-fundamentals': {
    easy: [
      {
        type: 'multiple-choice',
        question: 'What does "var" do in JavaScript?',
        options: ['Declares a variable', 'Creates a function', 'Imports a module', 'Defines a class'],
        correctAnswer: 'Declares a variable',
        explanation: 'The "var" keyword is used to declare variables in JavaScript.',
        difficulty: 'easy'
      },
      {
        type: 'true-false',
        question: 'JavaScript is a compiled language.',
        correctAnswer: 'false',
        explanation: 'JavaScript is an interpreted language, not a compiled language.',
        difficulty: 'easy'
      }
    ],
    medium: [
      {
        type: 'multiple-choice',
        question: 'What is the difference between "let" and "var"?',
        options: ['No difference', 'let has block scope, var has function scope', 'var is newer', 'let is faster'],
        correctAnswer: 'let has block scope, var has function scope',
        explanation: 'let and const have block scope, while var has function scope.',
        difficulty: 'medium'
      },
      {
        type: 'fill-blank',
        question: 'The method ______ is used to add an element to the end of an array.',
        correctAnswer: 'push',
        explanation: 'The push() method adds one or more elements to the end of an array.',
        difficulty: 'medium'
      }
    ]
  },
  'python-basics': {
    easy: [
      {
        type: 'multiple-choice',
        question: 'How do you create a comment in Python?',
        options: ['// comment', '/* comment */', '# comment', '<!-- comment -->'],
        correctAnswer: '# comment',
        explanation: 'In Python, comments start with the # symbol.',
        difficulty: 'easy'
      },
      {
        type: 'true-false',
        question: 'Python is case-sensitive.',
        correctAnswer: 'true',
        explanation: 'Python is case-sensitive, meaning "Variable" and "variable" are different.',
        difficulty: 'easy'
      }
    ],
    medium: [
      {
        type: 'multiple-choice',
        question: 'What is the correct way to create a list in Python?',
        options: ['list = {}', 'list = []', 'list = ()', 'list = ""'],
        correctAnswer: 'list = []',
        explanation: 'Square brackets [] are used to create lists in Python.',
        difficulty: 'medium'
      },
      {
        type: 'fill-blank',
        question: 'The ______ function is used to get the length of a list.',
        correctAnswer: 'len',
        explanation: 'The len() function returns the number of items in a list.',
        difficulty: 'medium'
      }
    ]
  },
  'react-concepts': {
    easy: [
      {
        type: 'multiple-choice',
        question: 'What is JSX?',
        options: ['A new programming language', 'A syntax extension for JavaScript', 'A database', 'A testing framework'],
        correctAnswer: 'A syntax extension for JavaScript',
        explanation: 'JSX is a syntax extension for JavaScript that allows you to write HTML-like code in React.',
        difficulty: 'easy'
      },
      {
        type: 'true-false',
        question: 'React components must always return exactly one element.',
        correctAnswer: 'false',
        explanation: 'React components can return fragments, arrays, or single elements.',
        difficulty: 'easy'
      }
    ],
    medium: [
      {
        type: 'multiple-choice',
        question: 'Which hook is used to manage state in functional components?',
        options: ['useEffect', 'useState', 'useContext', 'useReducer'],
        correctAnswer: 'useState',
        explanation: 'useState is the primary hook for managing state in functional React components.',
        difficulty: 'medium'
      },
      {
        type: 'fill-blank',
        question: 'The ______ hook is used to perform side effects in React components.',
        correctAnswer: 'useEffect',
        explanation: 'useEffect is used for side effects like data fetching, subscriptions, or DOM manipulation.',
        difficulty: 'medium'
      }
    ]
  }
}

function createTestStaticAssets(outputDir = 'public/quiz-assets') {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const assets = []
  const topics = Object.keys(sampleQuestions)

  console.log('🎯 Creating test static quiz assets...')
  console.log('')

  for (const topicSlug of topics) {
    const topicName = topicSlug.replace(/-/g, ' ')
    const difficulties = Object.keys(sampleQuestions[topicSlug])

    for (const difficulty of difficulties) {
      const questionCount = 10
      const questions = sampleQuestions[topicSlug][difficulty]
      
      // Repeat questions to reach desired count
      const expandedQuestions = []
      for (let i = 0; i < questionCount; i++) {
        const baseQuestion = questions[i % questions.length]
        expandedQuestions.push({
          ...baseQuestion,
          id: `static-${generateAssetHash(topicName, difficulty, questionCount)}-${i}`,
          topicId: `static-${topicSlug}`,
          createdAt: new Date().toISOString(),
          bucket: 'new',
          correctCount: 0,
          incorrectCount: 0,
        })
      }

      const asset = {
        topic: topicName,
        difficulty,
        questionCount,
        questions: expandedQuestions,
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        hash: generateAssetHash(topicName, difficulty, questionCount)
      }

      const filename = createAssetFilename(topicName, difficulty, questionCount)
      const filepath = join(outputDir, filename)
      
      writeFileSync(filepath, JSON.stringify(asset, null, 2))
      assets.push(filename)
      
      console.log(`✅ Created: ${filename}`)
    }
  }

  // Create asset index
  const index = {}
  for (const filename of assets) {
    const match = filename.match(/(.+)-(\w+)-(\d+)q\.json$/)
    if (match) {
      const [, topicSlug, difficulty, questionCount] = match
      const key = `${topicSlug}-${difficulty}-${questionCount}`
      index[key] = `/quiz-assets/${filename}`
    }
  }

  const indexPath = join(outputDir, 'index.json')
  writeFileSync(indexPath, JSON.stringify(index, null, 2))
  
  console.log('')
  console.log(`📚 Created asset index: ${indexPath}`)
  console.log(`📊 Total assets: ${assets.length}`)

  return assets
}

// Run if called directly
if (require.main === module) {
  try {
    createTestStaticAssets()
    console.log('')
    console.log('🚀 Test assets created successfully!')
    console.log('   Next: Start your dev server and test the quiz generation API')
  } catch (error) {
    console.error('')
    console.error('❌ Error creating test assets:', error.message)
    process.exit(1)
  }
}

module.exports = { createTestStaticAssets }