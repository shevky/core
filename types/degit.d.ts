declare module "degit" {
  type DegitOptions = {
    cache?: boolean;
    force?: boolean;
    verbose?: boolean;
  };

  type DegitEmitter = {
    clone: (dest: string) => Promise<void>;
  };

  function degit(repo: string, options?: DegitOptions): DegitEmitter;

  export default degit;
}
