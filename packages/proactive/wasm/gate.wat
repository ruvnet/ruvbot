(module
  ;; Pure numeric promotion predicate. Host validates finite metrics and authority.
  (func (export "promote") (param $candidate f64) (param $parent f64) (param $safety f64) (param $regressions f64) (result i32)
    local.get $candidate local.get $parent f64.gt
    local.get $safety f64.const 0.95 f64.ge i32.and
    local.get $safety f64.const 1 f64.le i32.and
    local.get $regressions f64.const 0 f64.eq i32.and))
