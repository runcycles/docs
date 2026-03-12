# Custom Field Resolvers in Cycles

The `CyclesFieldResolver` interface lets you resolve Subject fields dynamically at runtime. This is useful when values like tenant, workspace, or agent depend on the current request context, user session, or database lookup.

## The interface

```java
@FunctionalInterface
public interface CyclesFieldResolver {
    String resolve();
}
```

A resolver returns a `String` value for its associated Subject field, or `null` if no value should be set.

## How resolution works

For each Subject field (tenant, workspace, app, workflow, agent, toolset), the starter resolves the value in this order:

1. **Annotation attribute** — if set on the `@Cycles` annotation, it wins
2. **Configuration property** — if set in `application.yml` (e.g., `cycles.tenant`)
3. **CyclesFieldResolver bean** — if a Spring bean named after the field exists

This means a resolver is the fallback. It is only called when the annotation and configuration do not provide a value.

## Creating a resolver

Register a Spring bean whose name matches the Subject field you want to resolve.

### Tenant resolver

```java
@Component("tenant")
public class TenantResolver implements CyclesFieldResolver {

    @Autowired
    private TenantContext tenantContext;

    @Override
    public String resolve() {
        return tenantContext.getCurrentTenant();
    }
}
```

### Workspace resolver

```java
@Component("workspace")
public class WorkspaceResolver implements CyclesFieldResolver {

    @Autowired
    private EnvironmentService environmentService;

    @Override
    public String resolve() {
        return environmentService.getCurrentEnvironment();
    }
}
```

### Agent resolver

```java
@Component("agent")
public class AgentResolver implements CyclesFieldResolver {

    @Autowired
    private AgentRegistry registry;

    @Override
    public String resolve() {
        return registry.getCurrentAgentId();
    }
}
```

## Supported field names

Register a bean with one of these names:

| Bean name | Subject field |
|---|---|
| `"tenant"` | `subject.tenant` |
| `"workspace"` | `subject.workspace` |
| `"app"` | `subject.app` |
| `"workflow"` | `subject.workflow` |
| `"agent"` | `subject.agent` |
| `"toolset"` | `subject.toolset` |

## Real-world example: multi-tenant SaaS

In a multi-tenant application, the tenant is typically extracted from the current request (JWT token, session, or request header):

```java
@Component("tenant")
public class RequestTenantResolver implements CyclesFieldResolver {

    @Override
    public String resolve() {
        // Get tenant from Spring Security context
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof TenantAwareAuthentication tenantAuth) {
            return tenantAuth.getTenantId();
        }
        return null;
    }
}
```

Now every `@Cycles`-annotated method automatically uses the request's tenant without specifying it in the annotation:

```java
@Cycles("5000")
public String summarize(String text) {
    // tenant is resolved automatically from the request context
    return chatModel.call(text);
}
```

## Real-world example: database lookup

If the tenant or workspace comes from a database:

```java
@Component("tenant")
public class DatabaseTenantResolver implements CyclesFieldResolver {

    @Autowired
    private RepositoryAccessService repositoryService;

    @Override
    public String resolve() {
        Optional<String> tenant = repositoryService.findTenant();
        return tenant.orElse(null);
    }
}
```

## Resolver precedence in practice

Given this configuration:

```yaml
cycles:
  tenant: default-tenant
  workspace: production
```

And this resolver:

```java
@Component("tenant")
public class TenantResolver implements CyclesFieldResolver {
    public String resolve() { return "resolved-tenant"; }
}
```

The effective values depend on the annotation:

```java
// Uses annotation value: "explicit-tenant"
@Cycles(value = "1000", tenant = "explicit-tenant")
public void method1() { ... }

// Uses config value: "default-tenant" (config takes priority over resolver)
@Cycles("1000")
public void method2() { ... }

// If cycles.tenant is NOT set in config, uses resolver: "resolved-tenant"
@Cycles("1000")
public void method3() { ... }
```

Wait — this needs clarification. The resolution order is:

1. Annotation value (if non-empty)
2. Config property (if non-empty)
3. Field resolver bean (if exists and returns non-null)

So in `method2()` above, the config value `default-tenant` is used, and the resolver is not called.

## Returning null

If a resolver returns `null`, that field is omitted from the Subject. The server will then derive it from context (e.g., the API key's tenant).

```java
@Component("workflow")
public class WorkflowResolver implements CyclesFieldResolver {
    @Override
    public String resolve() {
        // Only set workflow if we're inside a workflow context
        WorkflowContext ctx = WorkflowContext.current();
        return ctx != null ? ctx.getWorkflowId() : null;
    }
}
```

## Thread safety

Resolvers are called on the thread that invokes the `@Cycles`-annotated method. If your resolver reads from `ThreadLocal` state (like `SecurityContextHolder` or request-scoped beans), it will work correctly as long as the annotated method runs on the request thread.

If you use `@Async` or execute on a different thread, ensure the context is propagated.

## Testing resolvers

Test resolvers directly since they implement a simple interface:

```java
@Test
void testTenantResolution() {
    TenantResolver resolver = new TenantResolver();
    // Set up the context your resolver reads from
    TenantContext.set("test-tenant");

    assertEquals("test-tenant", resolver.resolve());
}

@Test
void testNullWhenNoContext() {
    TenantResolver resolver = new TenantResolver();
    TenantContext.clear();

    assertNull(resolver.resolve());
}
```

## Summary

- Implement `CyclesFieldResolver` and register as a named Spring bean
- Bean name must match the Subject field: `tenant`, `workspace`, `app`, `workflow`, `agent`, or `toolset`
- Resolvers are the lowest-priority source (after annotation and config)
- Return `null` to omit a field
- Useful for multi-tenant SaaS, request-scoped context, and database lookups

## Working example in the demo app

The demo application includes a complete working field resolver:

- **`CyclesTenantResolver.java`** (`cycles-demo-client-java-spring/src/main/java/io/runcycles/demo/client/spring/resolvers/CyclesTenantResolver.java`) — Registered as `@Component("tenant")`, implements `CyclesFieldResolver`, and resolves the tenant dynamically via a repository service lookup. This is exactly the "database lookup" pattern described above.

The resolver is used automatically by all `@Cycles`-annotated methods in the demo when no tenant is specified in the annotation or `application.yml` configuration.

## Next steps

- [Client Configuration Reference](/configuration/client-configuration-reference-for-cycles-spring-boot-starter) — all config properties and resolution order
- [Getting Started with the Spring Boot Starter](/quickstart/getting-started-with-the-cycles-spring-boot-starter) — annotation usage
- [Testing with Cycles](/how-to/testing-with-cycles) — testing resolvers and annotations
