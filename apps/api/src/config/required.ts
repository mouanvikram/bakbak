// Environment-sensitive requirements.


export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

type Requirement = {
  devDefault?: string;
  insecureDevDefault?: string;
  minLength?: number;
};

function fail(name: string, reason: string): never {
  throw new Error(`${name} ${reason}. See .env.example.`);
}

function checkProduction(
  value: string,
  name: string,
  { insecureDevDefault, minLength }: Requirement,
): string {
  if (!value) {
    fail(name, "is missing and is required when NODE_ENV=production");
  }

  if (insecureDevDefault && value === insecureDevDefault) {
    fail(
      name,
      `is still the local development value "${insecureDevDefault}", which must not be used in production`,
    );
  }

  if (minLength && value.length < minLength) {
    fail(
      name,
      `is ${value.length} characters; production requires at least ${minLength}`,
    );
  }

  return value;
}

// Mandatory in all enviromnemnts (tests,dev,prod)
export function requiredAlways(
  value: string | undefined,
  name: string,
  requirement: Pick<Requirement, "minLength"> = {},
): string {
  const actual = value?.trim() ?? "";

  if (!isProduction()) {
    if (!actual) {
      fail(
        name,
        "is missing — set it in the repo-root .env file (it is required in every environment)",
      );
    }
    return actual;
  }

  return checkProduction(actual, name, requirement);
}

// Mandatory in production
export function requiredInProduction(
  value: string | undefined,
  name: string,
  requirement: Requirement = {},
): string {
  const actual = value?.trim() ?? "";

  if (!isProduction()) {
    return (
      actual || requirement.insecureDevDefault || requirement.devDefault || ""
    );
  }

  return checkProduction(actual, name, requirement);
}

// warning/smell in production
export function warnInProduction(suspect: boolean, message: string): void {
  if (suspect && isProduction()) {
    console.warn(`[config] ${message}`);
  }
}
