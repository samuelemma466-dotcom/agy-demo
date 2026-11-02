local active_border_color = {
  colors = { "rgba(78B9E4ee)", "rgba(C2A8D9ee)" },
  angle = 45,
}
local inactive_border_color = "rgba(71818D88)"

hl.config({
  general = {
    -- Omarchy's normal tiling and floating rules stay in place; these are
    -- presentation values only and apply when this theme is activated.
    gaps_in = 5,
    gaps_out = 12,
    border_size = 2,
    col = {
      active_border = active_border_color,
      inactive_border = inactive_border_color,
    },
  },
  group = {
    col = {
      border_active = active_border_color,
      border_inactive = inactive_border_color,
    },
  },
  decoration = {
    rounding = 10,
    rounding_power = 3,
    active_opacity = 0.98,
    inactive_opacity = 0.96,
    shadow = {
      enabled = true,
      range = 12,
      render_power = 3,
      color = "rgba(05091250)",
      color_inactive = "rgba(05091230)",
    },
    blur = {
      enabled = true,
      size = 5,
      passes = 2,
      new_optimizations = true,
      ignore_opacity = false,
      noise = 0.015,
      contrast = 1.0,
      brightness = 0.96,
      vibrancy = 0.12,
    },
  },
  animations = { enabled = true },
})

hl.curve("omachyEaseOut", {
  type = "bezier",
  points = { { 0.22, 1.0 }, { 0.36, 1.0 } },
})
hl.animation({ leaf = "windows", enabled = true, speed = 4.2, bezier = "omachyEaseOut" })
hl.animation({ leaf = "windowsIn", enabled = true, speed = 3.8, bezier = "omachyEaseOut", style = "popin 94%" })
hl.animation({ leaf = "windowsOut", enabled = true, speed = 2.8, bezier = "omachyEaseOut", style = "popin 94%" })
hl.animation({ leaf = "fadeIn", enabled = true, speed = 2.2, bezier = "omachyEaseOut" })
hl.animation({ leaf = "fadeOut", enabled = true, speed = 1.8, bezier = "omachyEaseOut" })
hl.animation({ leaf = "workspaces", enabled = true, speed = 3.4, bezier = "omachyEaseOut", style = "slidefade 12%" })
