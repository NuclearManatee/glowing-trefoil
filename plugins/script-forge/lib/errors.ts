export const EXIT_SUCCESS = 0;
export const EXIT_USER = 1;
export const EXIT_ENVIRONMENT = 2;
export const EXIT_EXTERNAL = 3;
export const EXIT_INTERNAL = 4;
export const EXIT_INTERRUPTED = 130;

export class CliError extends Error {
	readonly exitCode: number;

	constructor(message: string, exitCode: number) {
		super(message);
		this.name = "CliError";
		this.exitCode = exitCode;
	}
}

export function userError(message: string): CliError {
	return new CliError(message, EXIT_USER);
}

export function environmentError(message: string): CliError {
	return new CliError(message, EXIT_ENVIRONMENT);
}

export function externalError(message: string): CliError {
	return new CliError(message, EXIT_EXTERNAL);
}

export function internalError(message: string): CliError {
	return new CliError(message, EXIT_INTERNAL);
}
