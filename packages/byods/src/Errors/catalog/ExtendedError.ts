import {ErrorMessage, ERROR_TYPE} from '../types';

/**
 *
 */
export default class ExtendedError extends Error {
  public type: ERROR_TYPE;

  /**
   * Constructs an ExtendedError instance.
   *
   * @param msg - The error message.
   * @param type - The type of the error.
   */
  constructor(msg: ErrorMessage, type: ERROR_TYPE = ERROR_TYPE.DEFAULT) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, ExtendedError.prototype);
  }
}
