declare module 'heic-convert' {
  type Options = { buffer: Buffer | ArrayBuffer; format: 'JPEG' | 'PNG'; quality?: number };
  function convert(options: Options): Promise<ArrayBuffer>;
  export default convert;
}
