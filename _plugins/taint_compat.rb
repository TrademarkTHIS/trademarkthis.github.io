# Compatibility shim for Ruby 3.4+/4.0+: restore `tainted?` used by Liquid/Jekyll
unless {}.respond_to?(:tainted?)
  class Object
    def tainted?
      false
    end
  end
end
