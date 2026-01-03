# Cursor Rules Summary

**Complete overview of all Cursor AI rules for the NEAR Intents Simulator**

## Rule Activation

### Always Apply
- **`near-intents-simulator-guide.mdc`** - Master project guide (always loaded)

### Auto-Attach (via globs)
Rules are automatically attached when editing files matching their glob patterns:

- **`near-intents-architecture.mdc`** → `src/intents/**/*.ts`, `src/**/simulator*.ts`
- **`adapter-implementation.mdc`** → `src/**/*adapter*.ts`, `**/adapters/**/*.ts`
- **`code-quality.mdc`** → `src/**/*.ts`
- **`testing-development.mdc`** → `**/*.test.ts`, `**/__tests__/**/*.ts`
- **`type-safety-and-interfaces.mdc`** → `src/types.ts`, `src/**/*.ts`
- **`error-handling-patterns.mdc`** → `src/intents/**/*.ts`, `src/**/*adapter*.ts`
- **`integration-with-cross-chain-simulator.mdc`** → `src/**/*adapter*.ts`, `src/**/*near*.ts`

### Manual Activation
Request rules by mentioning their purpose:
- "Show adapter patterns" → `adapter-implementation.mdc`
- "How do I handle errors?" → `error-handling-patterns.mdc`
- "Type safety guidance" → `type-safety-and-interfaces.mdc`

## Rule Categories

### Core Development Rules

#### 1. `near-intents-simulator-guide.mdc` (Always Applied)
**Purpose**: Master navigation and project overview
- Project structure and architecture
- Current implementation status
- Quick reference commands
- Data models and interfaces
- Development phases

**Key Content**:
- Real infrastructure architecture
- Factory pattern usage
- Common development patterns
- Troubleshooting guide

#### 2. `near-intents-architecture.mdc` (Auto: simulator files)
**Purpose**: NEAR Intents Protocol implementation patterns
- Quote calculation flow
- Fee models and slippage
- Route generation
- Asset registry management
- Execution simulation

**Key Patterns**:
- Asset parsing and validation
- Cross-chain routing
- Time estimation logic
- Mock transaction generation

#### 3. `adapter-implementation.mdc` (Auto: adapter files)
**Purpose**: Adapter interface implementations
- NearExecutionAdapter implementations
- CrossChainAdapter implementations
- Localnet vs Mock adapters
- Error handling in adapters

**Key Implementations**:
- LocalnetNearExecutor
- LocalnetMPCAdapter
- Mock adapters for testing
- Connection management

### Quality and Safety Rules

#### 4. `code-quality.mdc` (Auto: all TypeScript files)
**Purpose**: TypeScript best practices and code standards
- Type safety patterns
- Interface design
- Error handling strategies
- Code organization
- Documentation standards

**Key Standards**:
- Strict null checks
- Union types for state
- Interface composition
- Performance optimization
- Testing standards

#### 5. `type-safety-and-interfaces.mdc` (Auto: types and TS files)
**Purpose**: Advanced TypeScript type patterns
- Strict type safety
- Branded types
- Type guards and narrowing
- Conditional and mapped types
- Template literal types

**Advanced Patterns**:
- Type guards for validation
- Discriminated unions
- Generic constraints
- Result type pattern
- Custom error types

#### 6. `error-handling-patterns.mdc` (Auto: simulator and adapter files)
**Purpose**: Comprehensive error handling
- Custom error hierarchy
- Validation patterns
- Graceful degradation
- Retry and circuit breaker
- Structured logging

**Error Patterns**:
- ValidationError, AdapterError, ExecutionError
- Graceful fallback to mocks
- Retry with exponential backoff
- Circuit breaker for adapters
- Structured error logging

### Integration Rules

#### 7. `integration-with-cross-chain-simulator.mdc` (Auto: adapter/integration files)
**Purpose**: Real infrastructure integration
- Importing from cross-chain-simulator
- NEAR localnet integration
- MPC network integration
- Environment detection
- Testing with real infrastructure

**Integration Patterns**:
- Configuration import
- Adapter initialization
- Health checks
- Fallback patterns
- Testing workflows

### Development Workflow Rules

#### 8. `testing-development.mdc` (Auto: test files)
**Purpose**: Testing and development workflows
- Unit testing patterns
- Integration testing
- Mock implementations
- Debugging techniques
- Performance testing

**Testing Patterns**:
- Quote calculation tests
- Route calculation tests
- Status tracking tests
- Adapter testing
- Error scenario testing

## Using Rules Effectively

### For New Features

1. **Start**: `near-intents-simulator-guide.mdc` (always available)
2. **Architecture**: `near-intents-architecture.mdc` (for simulator logic)
3. **Types**: `type-safety-and-interfaces.mdc` (for new types)
4. **Adapters**: `adapter-implementation.mdc` (for adapter code)
5. **Errors**: `error-handling-patterns.mdc` (for error handling)
6. **Tests**: `testing-development.mdc` (for test writing)

### For Code Reviews

1. **Quality**: `code-quality.mdc` - Check against standards
2. **Types**: `type-safety-and-interfaces.mdc` - Verify type safety
3. **Errors**: `error-handling-patterns.mdc` - Review error handling
4. **Architecture**: `near-intents-architecture.mdc` - Verify patterns

### For Debugging

1. **Errors**: `error-handling-patterns.mdc` - Check error patterns
2. **Testing**: `testing-development.mdc` - Review debugging techniques
3. **Adapters**: `adapter-implementation.mdc` - Check adapter issues
4. **Integration**: `integration-with-cross-chain-simulator.mdc` - Verify infrastructure

### File-Specific Guidance

When editing specific file types, relevant rules auto-attach:

- **`src/intents/simulator.ts`** → Architecture, Error Handling, Code Quality
- **`src/types.ts`** → Type Safety, Code Quality
- **`src/**/*adapter*.ts`** → Adapter Implementation, Integration, Error Handling
- **`**/*.test.ts`** → Testing & Development
- **`src/**/*.ts`** → Code Quality (all TypeScript files)

## Rule Metadata

Each rule includes metadata:
- **description**: What the rule covers
- **globs**: File patterns that auto-attach the rule
- **applicablePhases**: Development phases (1, 2, 3)
- **alwaysApply**: Whether rule is always loaded

## Best Practices

### Rule Request Patterns
- ✅ "Show me how to implement an adapter" → loads adapter-implementation
- ✅ "What are the error handling patterns?" → loads error-handling-patterns
- ✅ "How do I ensure type safety?" → loads type-safety-and-interfaces
- ✅ "How do I test this feature?" → loads testing-development

### Code Reference Patterns
Rules reference actual code using semantic references:
- Line references: `src/intents/simulator.ts:271-283`
- File references: `src/types.ts`
- Pattern references: "Reference validation in..."

### Pattern Examples
Rules include:
- ✅ Good examples (what to do)
- ❌ Bad examples (what to avoid)
- Code references to actual implementation
- Checklists for verification

## Rule Evolution

Rules are updated as the project evolves:
- **Phase 1** (Current): Core simulator patterns ✅
- **Phase 2**: Production integration patterns 🚀
- **Phase 3**: Advanced features and optimization 🏦

As new patterns emerge, relevant rules are updated to maintain consistency.

## Quick Reference

| Task | Primary Rule | Supporting Rules |
|------|--------------|------------------|
| Add new asset | architecture | type-safety, code-quality |
| Implement adapter | adapter-implementation | integration, error-handling |
| Add error handling | error-handling-patterns | type-safety, code-quality |
| Write tests | testing-development | code-quality, architecture |
| Integrate real infra | integration-with-cross-chain-simulator | adapter-implementation |
| Type safety | type-safety-and-interfaces | code-quality |
| Code review | code-quality | All relevant rules |

This summary helps navigate the complete rule system for efficient development with Cursor AI assistance.

