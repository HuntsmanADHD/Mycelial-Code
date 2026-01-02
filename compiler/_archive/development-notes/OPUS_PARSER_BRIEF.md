# Parser Agent Briefing - Opus

**From**: Haiku (Chief Operations Officer)
**Date**: 2026-01-01
**Subject**: M1 Week 5 - Parser Agent Implementation
**Duration**: Week 5 of M1

---

## Your Next Assignment

After completing the Code Generator Agent, you're now being assigned the **Parser Agent** for M1 Week 5.

This is a shift from x86-64 instruction selection to language parsing. You'll be building the component that transforms a stream of tokens into an Abstract Syntax Tree (AST).

---

## Why Parser Comes Next

**Pipeline Dependency**:
```
Week 4: Lexer Agent (tokenize source code)
  ↓ (Token stream)
Week 5: Parser Agent ← YOUR ROLE (build AST)
  ↓ (AST nodes)
Week 6: Type Checker Agent (validate and type AST)
  ↓ (Typed AST)
Week 8: IR Generator Agent (Sonnet - lower to IR)
```

**You're the critical link** between tokens and IR.

---

## What the Parser Does

**Input**: Token stream from Lexer Agent
```
Token { type: KEYWORD, value: "network" }
Token { type: IDENTIFIER, value: "HelloWorld" }
Token { type: LBRACE, value: "{" }
...
```

**Output**: Abstract Syntax Tree (AST)
```
Program {
  items: [
    NetworkDef {
      name: "HelloWorld",
      frequencies: [...],
      hyphae: [...],
      topology: [...]
    }
  ]
}
```

**Job**: Recognize language patterns and build tree structure

---

## Language Grammar Reference

**Source**: `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md` (389 lines)

**Key Grammar Rules** (simplified):

```ebnf
Program ::= (Frequency | NetworkDef)*

NetworkDef ::= 'network' IDENTIFIER '{'
                 Frequencies?
                 Hyphae?
                 Topology?
               '}'

Frequency ::= 'frequency' IDENTIFIER '{'
                (FrequencyField)*
              '}'

FrequencyField ::= IDENTIFIER ':' Type

HyphalDef ::= 'hyphal' IDENTIFIER '{'
                State?
                (Rule)+
              '}'

State ::= 'state' '{' (StateField)* '}'

StateField ::= IDENTIFIER ':' Type ('=' Literal)?

Rule ::= 'on' RuleType '{' (Statement)* '}'

RuleType ::= SignalMatch | 'rest' | 'cycle' NUMBER

SignalMatch ::= 'signal' '(' IDENTIFIER (',' IDENTIFIER)? ('where' Predicate)? ')'

Statement ::= Assignment | Conditional | Emit | Report | Spawn | Die

Expression ::= LogicalOr

LogicalOr ::= LogicalAnd ('||' LogicalAnd)*

LogicalAnd ::= Equality ('&&' Equality)*

Equality ::= Relational (('==' | '!=') Relational)*

Relational ::= Additive (('<' | '>' | '<=' | '>=') Additive)*

Additive ::= Multiplicative (('+' | '-') Multiplicative)*

Multiplicative ::= Unary (('*' | '/' | '%') Unary)*

Unary ::= ('!' | '-' | '+') Unary | Primary

Primary ::= Literal | Identifier | '(' Expression ')' | FieldAccess | Call
```

**Full grammar**: Read `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md`

---

## AST Node Structure Definitions

You must define these node types in Mycelial:

### Top Level

```
Program {
  items: Vec<ProgramItem>
}

ProgramItem =
  | Frequency(FrequencyDef)
  | Network(NetworkDef)
```

### Definitions

```
FrequencyDef {
  name: String,
  fields: Vec<(String, Type)>  // (field_name, field_type)
}

NetworkDef {
  name: String,
  frequencies: Option<Vec<FrequencyDef>>,
  hyphae: Option<Vec<HyphalDef>>,
  topology: Option<Vec<TopologyRule>>,
  config: Option<Vec<ConfigItem>>
}

HyphalDef {
  name: String,
  state: Option<StateBlock>,
  rules: Vec<Rule>
}

StateBlock {
  fields: Vec<StateField>
}

StateField {
  name: String,
  type_: Type,
  init: Option<Literal>
}

Rule {
  trigger: RuleTrigger,
  guard: Option<Expression>,
  body: Vec<Statement>
}

RuleTrigger =
  | SignalMatch { frequency: String, binding: Option<String> }
  | Rest
  | Cycle { number: u32 }
```

### Statements

```
Statement =
  | Assignment { target: AssignmentTarget, value: Expression }
  | Conditional { condition: Expression, then_body: Vec<Statement>, else_body: Option<Vec<Statement>> }
  | Emit { frequency: String, fields: Vec<(String, Expression)> }
  | Report { metric: String, value: Expression }
  | Spawn { hyphal: String, instance: String }
  | Die

AssignmentTarget =
  | Let { name: String }
  | StateField { field: String }
```

### Expressions

```
Expression =
  | Literal(Literal)
  | Identifier(String)
  | BinaryOp { op: BinaryOperator, left: Box<Expression>, right: Box<Expression> }
  | UnaryOp { op: UnaryOperator, operand: Box<Expression> }
  | FieldAccess { object: Box<Expression>, field: String }
  | SignalAccess { name: String }  // Binding from rule trigger
  | Call { name: String, args: Vec<Expression> }
  | StateAccess { field: String }

BinaryOperator = Add | Sub | Mul | Div | Mod | Eq | Ne | Lt | Gt | Le | Ge | And | Or

UnaryOperator = Not | Neg | Pos
```

### Types

```
Type =
  | U32
  | I32
  | U64
  | I64
  | F64
  | Boolean
  | String
  | Binary
  | Vec(Box<Type>)
  | Queue(Box<Type>)
  | Map(Box<Type>, Box<Type>)
```

### Literals

```
Literal =
  | Number(u64)
  | String(String)
  | Bool(bool)
  | List(Vec<Literal>)
```

---

## Implementation Requirements

### What You Must Implement

1. **Tokenizer Integration**
   - Accept tokens from Lexer agent
   - Track current position in token stream
   - Implement peek() to look ahead without consuming

2. **Recursive Descent Parser**
   - Implement parsing functions for each grammar rule
   - Follow grammar exactly as defined
   - Handle operator precedence correctly

3. **AST Construction**
   - Create AST nodes as you parse
   - Maintain source location info (line/column for errors)
   - Build complete tree structure

4. **Error Handling**
   - Report syntax errors with line/column numbers
   - Provide helpful error messages
   - Use position tracking for debugging

5. **Emit AST Nodes**
   - As you complete each node, emit it as a signal
   - Top-level: emit Program with all items
   - Type Checker will receive and validate

---

## Reference Implementation

**Existing Parser** (in JavaScript):
`/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/parser.js`

**Use this for**:
- Algorithm reference (how to structure recursive descent)
- Edge case handling
- Error recovery strategies
- Test case validation

**Note**: You're reimplementing in Mycelial, not copying code. But the logic is your reference.

---

## Success Criteria

✅ **Correctness**:
- All grammar rules implemented
- Operator precedence correct
- Recursive descent algorithm sound
- AST structure matches definitions above

✅ **Completeness**:
- Parse hello_world.mycelial successfully
- Parse all 6 example programs
- Handle all statement types
- Handle all expression types

✅ **Error Handling**:
- Report syntax errors with location info
- Don't crash on malformed input
- Provide helpful error messages

✅ **Integration**:
- Emit ASTNode signals to Type Checker
- Interface with Lexer token stream
- Integration test with hello_world example

---

## Testing Strategy

### Unit Tests (by grammar rule)

```
test_frequency_parsing()
test_network_parsing()
test_hyphal_parsing()
test_state_parsing()
test_rule_parsing()
test_expression_parsing()
test_assignment_parsing()
test_emit_parsing()
test_conditional_parsing()
```

### Integration Tests

```
test_hello_world_parsing()
test_counter_agent_parsing()
test_complex_network_parsing()
```

### Validation

Parse `/tests/*.mycelial` programs and verify AST structure matches expectations

---

## Critical Decisions You'll Make

### 1. Recursive Descent Implementation

**Approach**: One parsing function per grammar rule

```rust
fn parse_program() -> Program { ... }
fn parse_network_def() -> NetworkDef { ... }
fn parse_expression() -> Expression { ... }
fn parse_binary_op(left: Expression) -> Expression { ... }
```

**Advantages**: Clear, matches grammar 1:1

### 2. Operator Precedence Handling

**Approach**: Recursive descent with precedence climbing

```
parse_expression() calls parse_logical_or()
parse_logical_or() calls parse_logical_and()
parse_logical_and() calls parse_equality()
...
parse_unary() calls parse_primary()
```

Each level handles one operator precedence level.

### 3. Error Recovery

**Options**:
- A: Panic on first error (simple, MVP)
- B: Collect errors and continue (better UX)
- C: Resynchronization (complex but robust)

**Recommendation**: Start with A, add B if time permits

### 4. AST Location Tracking

**Store with every node**:
```
ASTNode {
  type: NodeType,
  location: SourceLocation { line: u32, column: u32 },
  data: NodeData
}
```

Needed for error messages and debugging.

---

## Integration Points

### Input: Lexer Agent

**Expects**:
- Token stream from Lexer
- Each token has: type, value, line, column
- EOF token at end

**Interface**:
```
receive signal(token, t) {
  // Store token in buffer
  vec_push(state.tokens, t)
}

receive signal(lex_complete, lc) {
  // Start parsing when lexer done
  let program = parse_program()
  emit ast_complete { program: program }
}
```

### Output: Type Checker Agent

**Emits**:
- AST nodes with location info
- Complete Program node with all items
- Error nodes if syntax errors occur

**Interface**:
```
emit ast_node {
  type: NodeType,
  location: SourceLocation,
  data: NodeData
}

emit parse_complete {
  program_id: u32,
  error_count: u32
}
```

---

## Your Timeline

### Day 1: Setup & Foundation
- [ ] Understand grammar completely
- [ ] Define all AST node types
- [ ] Plan recursive descent structure
- [ ] Set up test framework

### Day 2: Expression Parsing
- [ ] Implement primary expressions (literals, identifiers)
- [ ] Implement operator precedence (binary/unary ops)
- [ ] Test expression parsing
- [ ] Handle field access and calls

### Day 3: Statement Parsing
- [ ] Implement assignments
- [ ] Implement conditionals
- [ ] Implement emit statements
- [ ] Test statement parsing

### Day 4: Definition Parsing
- [ ] Implement frequency parsing
- [ ] Implement network parsing
- [ ] Implement hyphal parsing
- [ ] Implement rule parsing

### Day 5: Integration & Error Handling
- [ ] Integrate with Lexer input
- [ ] Add error handling and reporting
- [ ] Test full hello_world parse
- [ ] Debug any issues

### Day 6: Testing & Polish
- [ ] Unit tests for all rule types
- [ ] Integration tests with example programs
- [ ] Error message quality
- [ ] Finalize for Type Checker handoff

---

## Key Files to Reference

**Grammar**:
- `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md` - Complete formal grammar

**Reference Implementation**:
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/parser.js` - Existing parser logic
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/lexer.js` - Token structure

**Test Programs**:
- `/home/lewey/Desktop/mycelial-compiler/tests/hello_world.mycelial` - Your validation test
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/examples/*.mycelial` - 6 example programs

---

## Important Notes

### About hello_world.mycelial

This is your **reference test case**:

```mycelial
network HelloWorld {
  frequencies {
    greeting { name: string }
    response { message: string }
  }

  hyphae {
    hyphal greeter {
      on signal(greeting, g) {
        emit response {
          message: format("Hello, {}!", g.name)
        }
      }
    }
  }
}
```

Your parser **must** parse this correctly. This exact AST feeds to Type Checker → Sonnet's IR Generator.

### Critical for Sonnet

**Sonnet has been waiting for clarity on AST structure**. Your implementation answers:
- **Q5**: "What's the exact AST structure for expressions like `state.counter + 1`?"

By implementing the parser, you provide the answer through working code.

---

## Communication

### Questions?

- **On grammar**: Reference the formal GRAMMAR.md
- **On AST structure**: Check node definitions above
- **On algorithms**: Look at JS reference implementation
- **On integration**: Ask Haiku (me)
- **On Type Checker interface**: Coordinate once Parser is done

### Coordination with Sonnet

Once your Parser is complete:
1. Sonnet gets concrete AST examples from your tests
2. She can finalize her IR Generator implementation
3. Both of you align on node structures

---

## Tools & Support

**Available**:
- Language grammar (complete, formal specification)
- Reference JS implementation (algorithms & logic)
- 6 example programs (test cases)
- Haiku (me) for coordination questions
- Sonnet for IR Gen coordination

---

## Success = M1 Week 5 Complete

When you're done:
- ✅ Parser successfully implemented in Mycelial
- ✅ All example programs parse correctly
- ✅ AST structure matches definitions
- ✅ Error handling works
- ✅ Type Checker ready to receive AST nodes

Type Checker agent can then proceed with Week 6 work.

---

## Remember

You've already proven you can:
- Understand complex specifications (x86-64 instruction encoding)
- Implement sophisticated algorithms (register allocation)
- Write clean, testable Mycelial code (Code Gen agent)

**The Parser is just a new domain** - same skills, different problem.

You know grammar rules → implementation is straightforward recursive descent.

---

## Final Thought

The Parser is the **gateway** between human-readable code and machine-executable IR.

Make it beautiful. Make it correct. Make it the bridge that connects language to machine.

🚀

---

**Prepared by**: Haiku (Chief Operations Officer)
**Date**: 2026-01-01
**Role**: Parser Agent Owner (Week 5 of M1)
**Status**: Ready to Begin

---

**Next Steps**:
1. Read this brief completely
2. Study GRAMMAR.md thoroughly
3. Review reference JS implementation
4. Design your AST node types
5. Implement recursive descent parser
6. Test with hello_world.mycelial
7. Deliver to Type Checker agent

Ready? Let's build the parser. 🧬
