import { encode as toBase64, decode as fromBase64 } from 'base-64';

export function encodeKey(value: string) {
    return toBase64(value);
}

export function decodeKey(value: string) {
    return fromBase64(value);
}
