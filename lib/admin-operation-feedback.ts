const OPERATION_START = "admin-operation-start";
const OPERATION_END = "admin-operation-end";

export function beginAdminOperation(message = "Salvataggio…") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPERATION_START, { detail: { message } }));
  }
}

export function endAdminOperation() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPERATION_END));
}

export { OPERATION_END, OPERATION_START };
